import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MAX_AUDIO_BYTES, type Media } from '@langx/shared'
import { supportsPut, type StorageProvider } from '../../storage/StorageProvider'

/**
 * Making a browser's voice note playable on a phone.
 *
 * `MediaRecorder` on Chrome and Firefox produces WebM/Opus and nothing else —
 * expo-audio's web recorder asks for `audio/webm` and gets it — while iOS has
 * no Opus or WebM decoder at any level. So a note recorded on the site arrived
 * in a thread as a bubble an iPhone could not play, and the app's own honest
 * answer for that ("this will not play on this device") is a worse product
 * than the note simply working.
 *
 * `docs/architecture.md` says video is stored exactly as uploaded, with no
 * transcoding, and that still holds — a video is tens of megabytes and both
 * containers we accept play everywhere. This is the one exception, and it is
 * cheap for the same reason: a two-minute voice note is under a megabyte and
 * an Opus→AAC remux is about a second of CPU.
 *
 * **Synchronous, inside the send.** A queue would need a claim (two Fly
 * machines), a second socket event for chat, and something the feed does not
 * have at all — there is no `post:*` event, so a post's note would stay wrong
 * until the reader refetched. Doing it before the insert means the row is
 * right the first time anything reads it, and the only cost is latency inside
 * the client's twelve-second ack budget.
 *
 * **It never fails the send.** No ffmpeg on the host, a timeout, a file it
 * cannot read: the original is stored, exactly as before this existed, and the
 * bubble goes back to saying it cannot play it. That is the same bargain the
 * rest of the optional services make — see `docs/self-host.md`.
 */

/** What a browser records, and what no iPhone will decode. */
const TRANSCODE_FROM = new Set(['audio/webm', 'audio/ogg'])
/** AAC in MP4: what both phones record natively, so one playback path serves all of it. */
export const TRANSCODE_TO = 'audio/mp4'
/**
 * Well inside `SOCKET_ACK_TIMEOUT_MS`, which is 12s and is what the sender
 * actually waits. A two-minute note takes about a second; anything near this
 * is a machine in trouble, and the send is worth more than the conversion.
 */
const TRANSCODE_TIMEOUT_MS = 8_000

export function needsTranscode(contentType: string): boolean {
  return TRANSCODE_FROM.has(contentType.split(';')[0]?.trim().toLowerCase() ?? '')
}

/**
 * The key the converted file takes.
 *
 * Same directory and same name, new extension — `keyFromPublicUrl` recognises
 * our objects by the bucket prefix, so the URL has to stay inside it, and
 * `objectExtension` already maps `audio/mp4` to `.m4a`.
 */
export function transcodedKey(key: string): string {
  return `${key.replace(/\.[^./]+$/, '')}.m4a`
}

export interface TranscodeDeps {
  get(key: string): Promise<Uint8Array>
  put(key: string, body: Uint8Array, contentType: string): Promise<string>
  del(key: string): Promise<void>
  keyOf(url: string): string | null
  /** Returns `null` when the conversion could not be made, for any reason. */
  transcode(input: Uint8Array): Promise<Uint8Array | null>
  warn(error: unknown, message: string): void
}

/**
 * Runs ffmpeg over bytes we hold, and hands back AAC in MP4.
 *
 * Through temp files rather than pipes: the MP4 muxer rewinds to write the
 * index once it knows the durations, and a pipe cannot seek. `-f ipod` is the
 * spelling that makes ffmpeg emit the `.m4a` flavour of MP4 rather than one
 * announcing itself as video.
 */
export function ffmpegTranscoder(
  ffmpegPath: string,
  warn: (error: unknown, message: string) => void,
): (input: Uint8Array) => Promise<Uint8Array | null> {
  return async (input: Uint8Array): Promise<Uint8Array | null> => {
    const dir = await mkdtemp(join(tmpdir(), 'langx-audio-'))
    const source = join(dir, 'in')
    const target = join(dir, 'out.m4a')
    try {
      await writeFile(source, input)
      await new Promise<void>((resolve, reject) => {
        execFile(
          ffmpegPath,
          [
            '-nostdin',
            '-y',
            '-i',
            source,
            '-vn',
            '-c:a',
            'aac',
            '-b:a',
            '96k',
            '-f',
            'ipod',
            target,
          ],
          { timeout: TRANSCODE_TIMEOUT_MS },
          (error) => (error ? reject(new Error(error.message)) : resolve()),
        )
      })
      const output = await readFile(target)
      // A conversion that came out empty, or somehow larger than the ceiling
      // the upload was signed against, is not something to store.
      if (output.byteLength === 0 || output.byteLength > MAX_AUDIO_BYTES) return null
      return new Uint8Array(output)
    } catch (error) {
      warn(error, 'voice note transcode failed; storing the original')
      return null
    } finally {
      await rm(dir, { force: true, recursive: true })
    }
  }
}

/**
 * The attachments as they should be stored.
 *
 * Called after the allowlist and bucket checks and before the insert, which is
 * the order that matters: a URL that is not ours must never be fetched by this
 * server, and a row must never mention a file that is not there yet.
 */
export async function normalizeAttachments(
  deps: TranscodeDeps,
  attachments: readonly Media[],
): Promise<Media[]> {
  return await Promise.all(attachments.map((media) => normalizeOne(deps, media)))
}

async function normalizeOne(deps: TranscodeDeps, media: Media): Promise<Media> {
  if (!needsTranscode(media.contentType)) return media
  const key = deps.keyOf(media.url)
  if (!key) return media

  try {
    const converted = await deps.transcode(await deps.get(key))
    if (!converted) return media

    const url = await deps.put(transcodedKey(key), converted, TRANSCODE_TO)
    // Best-effort, and after the new object exists: a leaked original costs
    // bytes, while deleting first and then failing to write costs the note.
    // `deleteAttachment` swallows in the same way and for the same reason.
    try {
      await deps.del(key)
    } catch (error) {
      deps.warn(error, 'could not remove the original of a transcoded voice note')
    }

    return { ...media, url, contentType: TRANSCODE_TO, sizeBytes: converted.byteLength }
  } catch (error) {
    deps.warn(error, 'could not transcode a voice note; storing the original')
    return media
  }
}

/**
 * The normaliser this app runs with, or the identity function.
 *
 * Identity when storage cannot be read and written server-side, which is the
 * unconfigured case a self-hoster boots into. ffmpeg's own absence is not
 * checked here — it shows up as a failed conversion on the first note, once,
 * and the note is stored as recorded.
 */
export function createAttachmentNormalizer(
  storage: StorageProvider,
  ffmpegPath: string,
  warn: (error: unknown, message: string) => void,
): AttachmentNormalizer {
  if (!supportsPut(storage)) return (attachments) => Promise.resolve([...attachments])
  const deps: TranscodeDeps = {
    get: (key) => storage.getObject(key),
    put: (key, body, contentType) => storage.putObject(key, body, contentType),
    del: (key) => storage.deleteObject(key),
    keyOf: (url) => storage.keyFromPublicUrl(url),
    transcode: ffmpegTranscoder(ffmpegPath, warn),
    warn,
  }
  return (attachments) => normalizeAttachments(deps, attachments)
}

/** What the insert paths are handed, so a test can pass a plain function. */
export type AttachmentNormalizer = (attachments: readonly Media[]) => Promise<Media[]>
