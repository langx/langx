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

/** Every audio type the upload endpoint signs, honest label or not. */
const AUDIO_PREFIX = 'audio/'
/** AAC in MP4: what both phones record natively, so one playback path serves all of it. */
export const TRANSCODE_TO = 'audio/mp4'
/**
 * Well inside `SOCKET_ACK_TIMEOUT_MS`, which is 12s and is what the sender
 * actually waits. A two-minute note takes about a second; anything near this
 * is a machine in trouble, and the send is worth more than the conversion.
 */
const TRANSCODE_TIMEOUT_MS = 8_000

/**
 * Whether a file is worth looking inside, which is every voice note.
 *
 * The label is not enough, and the note that started this proves it: it was
 * stored as `audio/m4a`, under a `.m4a` key, and the bytes were WebM. An older
 * web build labelled every recording `audio/m4a` regardless of what
 * `MediaRecorder` had produced, so the one attribute a reader could check was
 * the one thing that had been guessed. A file that says `.m4a` and is Opus is
 * exactly a bubble that will not play with nothing anywhere saying why.
 *
 * The cost is a GET per voice note — a hundred kilobytes or so, from a bucket
 * in the next region, inside a send that already waits on a socket ack. A
 * photo, a video and a note that turns out to be AAC are all untouched.
 */
function worthSniffing(contentType: string): boolean {
  return contentType.split(';')[0]?.trim().toLowerCase().startsWith(AUDIO_PREFIX) ?? false
}

/**
 * What the bytes actually are, for the two containers iOS cannot open.
 *
 * `1A 45 DF A3` is EBML, which is Matroska and therefore WebM; `OggS` is Ogg.
 * Anything else — AAC in MP4, ADTS, MP3 — is left alone, so this says "no"
 * for every honest file and does not have to recognise them.
 */
export function isUndecodableOnIos(bytes: Uint8Array): boolean {
  const ebml = [0x1a, 0x45, 0xdf, 0xa3]
  const ogg = [0x4f, 0x67, 0x67, 0x53]
  return [ebml, ogg].some((magic) => magic.every((byte, index) => bytes[index] === byte))
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
  if (!worthSniffing(media.contentType)) return media
  const key = deps.keyOf(media.url)
  if (!key) return media

  try {
    const bytes = await deps.get(key)
    // The label may say anything; this is what the phone will actually be
    // handed. An honest `audio/mp4` and a mislabelled one both end here.
    if (!isUndecodableOnIos(bytes)) return media

    const converted = await deps.transcode(bytes)
    if (!converted) return media

    const target = transcodedKey(key)
    const url = await deps.put(target, converted, TRANSCODE_TO)

    /*
     * Only when the conversion landed somewhere else. A mislabelled note is
     * already under a `.m4a` key, so the new object *is* the old one — and
     * deleting it here would delete the file just written, which is the one
     * way this could lose a message rather than merely fail to improve it.
     */
    if (target !== key) {
      // Best-effort, and after the new object exists: a leaked original costs
      // bytes, while deleting first and then failing to write costs the note.
      // `deleteAttachment` swallows in the same way and for the same reason.
      try {
        await deps.del(key)
      } catch (error) {
        deps.warn(error, 'could not remove the original of a transcoded voice note')
      }
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
