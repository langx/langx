import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MAX_AUDIO_SECONDS, WAVEFORM_BARS, WAVEFORM_PEAK } from '@langx/shared'

/**
 * The bars a voice-note bubble draws, read out of the file once, here.
 *
 * Here because this is the one place every note's bytes already pass through:
 * `normalizeAttachments` fetches each one to sniff it, whichever device
 * recorded it. The recorder's metering was the other candidate: it samples
 * only as often as a status update arrives, every installed build would still
 * send nothing, and an array a client sends is an array a client can invent.
 * See `docs/decisions.md` → _A voice note's waveform is read by the server_.
 */

/**
 * Loud enough to find the syllables, and nothing more: the bars are an
 * outline of where somebody spoke, not an analysis. Two minutes at this rate
 * is under two megabytes of samples.
 */
const SAMPLE_RATE = 8_000
/** Signed 16-bit mono, which is what `-f s16le -ac 1` hands back. */
const BYTES_PER_SAMPLE = 2
/**
 * The longest note the upload allows, twice over. `durationSeconds` is the
 * recorder's claim, so the file can run a little long; one that runs far
 * longer gets no waveform rather than an unbounded buffer.
 */
const MAX_PCM_BYTES = 2 * MAX_AUDIO_SECONDS * SAMPLE_RATE * BYTES_PER_SAMPLE
/**
 * Decoding a two-minute note to 8kHz mono takes a fraction of a second. This
 * runs beside the transcode rather than after it, so it does not add to the
 * eight seconds that one is given inside the twelve-second ack.
 */
const WAVEFORM_TIMEOUT_MS = 4_000

/**
 * The loudest sample in each of `bars` equal slices, scaled so the loudest
 * slice is `WAVEFORM_PEAK`.
 *
 * Scaled to the note's own peak rather than to full scale: a note recorded at
 * arm's length is as much speech as one recorded up close, and its outline
 * should be as readable. A silent note stays flat, which is what it is.
 *
 * `null` for no audio at all — an empty decode is a failure, not a waveform.
 */
export function waveformFromPcm(pcm: Uint8Array, bars = WAVEFORM_BARS): number[] | null {
  const samples = Math.floor(pcm.byteLength / BYTES_PER_SAMPLE)
  if (samples === 0) return null
  // A `DataView`, not an `Int16Array`: the buffer execFile hands back need
  // not start on an even byte, and the typed array throws when it does not.
  const view = new DataView(pcm.buffer, pcm.byteOffset, samples * BYTES_PER_SAMPLE)

  const peaks = Array.from({ length: bars }, (_, bar) => {
    const start = Math.floor((bar * samples) / bars)
    const end = Math.floor(((bar + 1) * samples) / bars)
    let peak = 0
    for (let i = start; i < end; i++) {
      peak = Math.max(peak, Math.abs(view.getInt16(i * BYTES_PER_SAMPLE, true)))
    }
    return peak
  })

  const loudest = Math.max(...peaks)
  return peaks.map((peak) => (loudest === 0 ? 0 : Math.round((peak / loudest) * WAVEFORM_PEAK)))
}

/**
 * Runs ffmpeg over a voice note and hands back its waveform, or `null`.
 *
 * Through a temp file for the input, as the transcoder does: an iPhone's `.m4a`
 * keeps its index at the end, and ffmpeg cannot seek back to it on a pipe. The
 * output is raw samples, which need no seeking, so it comes back on stdout.
 *
 * Never rejects. No ffmpeg, a timeout, a file it cannot decode: the note is
 * stored without a waveform, and the bubble draws the even bars it draws for
 * every note older than this.
 */
export function ffmpegWaveform(
  ffmpegPath: string,
  warn: (error: unknown, message: string) => void,
): (input: Uint8Array) => Promise<number[] | null> {
  return async (input: Uint8Array): Promise<number[] | null> => {
    let dir: string | undefined
    try {
      dir = await mkdtemp(join(tmpdir(), 'langx-waveform-'))
      const source = join(dir, 'in')
      await writeFile(source, input)
      const pcm = await new Promise<Buffer>((resolve, reject) => {
        execFile(
          ffmpegPath,
          [
            '-nostdin',
            '-i',
            source,
            '-vn',
            '-ac',
            '1',
            '-ar',
            String(SAMPLE_RATE),
            '-f',
            's16le',
            'pipe:1',
          ],
          { encoding: 'buffer', maxBuffer: MAX_PCM_BYTES, timeout: WAVEFORM_TIMEOUT_MS },
          (error, stdout) => (error ? reject(new Error(error.message)) : resolve(stdout)),
        )
      })
      return waveformFromPcm(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength))
    } catch (error) {
      warn(error, 'voice note waveform failed; storing the note without one')
      return null
    } finally {
      if (dir) await rm(dir, { force: true, recursive: true })
    }
  }
}
