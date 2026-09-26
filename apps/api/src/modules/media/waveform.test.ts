import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { WAVEFORM_BARS, WAVEFORM_PEAK } from '@langx/shared'
import { ffmpegTranscoder, normalizeAttachments } from './transcodeAudio'
import { ffmpegWaveform, waveformFromPcm } from './waveform'

/** Little-endian signed 16-bit, which is what ffmpeg's `s16le` writes. */
function pcm(samples: number[]): Uint8Array {
  const bytes = new Uint8Array(samples.length * 2)
  const view = new DataView(bytes.buffer)
  samples.forEach((sample, i) => view.setInt16(i * 2, sample, true))
  return bytes
}

describe('waveformFromPcm', () => {
  it('takes the loudest sample of each slice, scaled to the loudest slice', () => {
    // Four slices of two samples; the sign does not matter, the size does.
    expect(waveformFromPcm(pcm([0, 100, -200, 50, 400, 0, 0, -100]), 4)).toEqual([25, 50, 100, 25])
  })

  it('draws a quiet note as tall as a loud one', () => {
    const quiet = waveformFromPcm(pcm([10, 20, 40, 20]), 4)
    const loud = waveformFromPcm(pcm([1000, 2000, 4000, 2000]), 4)
    expect(quiet).toEqual(loud)
    expect(Math.max(...(quiet ?? []))).toBe(WAVEFORM_PEAK)
  })

  it('stores a silent note as flat rather than dividing by nothing', () => {
    expect(waveformFromPcm(pcm([0, 0, 0, 0]), 2)).toEqual([0, 0])
  })

  it('is always the stored length, even for fewer samples than bars', () => {
    const waveform = waveformFromPcm(pcm([5, 10, 20]))
    expect(waveform).toHaveLength(WAVEFORM_BARS)
    expect(waveform?.every((value) => Number.isInteger(value))).toBe(true)
  })

  it('has nothing to say about no audio at all', () => {
    expect(waveformFromPcm(new Uint8Array())).toBeNull()
    expect(waveformFromPcm(new Uint8Array([1]))).toBeNull()
  })

  // What execFile hands back can be a slice of a larger buffer at an odd
  // offset, where an `Int16Array` view throws.
  it('reads samples that do not start on an even byte', () => {
    const padded = new Uint8Array(9)
    padded.set(pcm([0, 100, 0, 200]), 1)
    expect(waveformFromPcm(padded.subarray(1), 2)).toEqual([50, 100])
  })
})

/*
 * The real binary, when there is one. The image ships it; a laptop or a CI
 * runner may not, and the rest of this suite never needs it.
 */
const hasFfmpeg = spawnSync('ffmpeg', ['-version']).status === 0

describe.skipIf(!hasFfmpeg)('with ffmpeg', () => {
  const dir = mkdtempSync(join(tmpdir(), 'langx-waveform-test-'))
  afterAll(() => rmSync(dir, { force: true, recursive: true }))

  /** Two seconds of tone that gets louder, so the outline has a direction. */
  function tone(file: string, codec: string[]): Uint8Array {
    const target = join(dir, file)
    execFileSync(
      'ffmpeg',
      [
        '-nostdin',
        '-y',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:duration=2',
        '-af',
        'volume=t/2:eval=frame',
        ...codec,
        target,
      ],
      { stdio: 'ignore' },
    )
    return new Uint8Array(readFileSync(target))
  }

  it('reads a phone-style AAC note into the stored number of bars', async () => {
    const warn = vi.fn()
    const waveform = await ffmpegWaveform('ffmpeg', warn)(tone('a.m4a', ['-c:a', 'aac']))

    expect(warn).not.toHaveBeenCalled()
    expect(waveform).toHaveLength(WAVEFORM_BARS)
    expect(Math.max(...(waveform ?? []))).toBe(WAVEFORM_PEAK)
    expect(waveform?.[0]).toBeLessThan(waveform?.[WAVEFORM_BARS - 1] ?? 0)
  })

  it('gives a converted browser note a waveform of the stored length', async () => {
    const warn = vi.fn()
    const webm = tone('b.webm', ['-c:a', 'libopus'])
    const [note] = await normalizeAttachments(
      {
        get: () => Promise.resolve(webm),
        put: (key) => Promise.resolve(`https://cdn.example.com/${key}`),
        del: () => Promise.resolve(),
        keyOf: (url) => url.replace('https://cdn.example.com/', ''),
        transcode: ffmpegTranscoder('ffmpeg', warn),
        waveform: ffmpegWaveform('ffmpeg', warn),
        warn,
      },
      [
        {
          url: 'https://cdn.example.com/messages/c1/b.webm',
          contentType: 'audio/webm',
          sizeBytes: webm.byteLength,
          durationSeconds: 2,
        },
      ],
    )

    expect(warn).not.toHaveBeenCalled()
    expect(note?.contentType).toBe('audio/mp4')
    expect(note?.waveform).toHaveLength(WAVEFORM_BARS)
  })

  it('stores no waveform for bytes that are not audio', async () => {
    const warn = vi.fn()
    const waveform = await ffmpegWaveform('ffmpeg', warn)(new Uint8Array([1, 2, 3, 4]))

    expect(waveform).toBeNull()
    expect(warn).toHaveBeenCalled()
  })
})
