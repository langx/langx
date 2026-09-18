/**
 * Writes a soft music bed to `out/bed.wav`, as many seconds long as asked for.
 *
 * Synthesised here rather than shipped as a file, because a repository that is
 * public cannot carry somebody else's track and a track nobody has licensed
 * cannot go under an advert. What this makes is deliberately plain: a
 * music-box arpeggio over a low pad, in one pentatonic scale, where no two
 * notes can clash. It is a bed for a twenty-second product clip, not a piece
 * of music.
 *
 * The better bed is the one Instagram and TikTok add themselves, from their
 * own licensed libraries, at upload time — that is what they promote and what
 * cannot get a post muted. Use this one for the cut you are reviewing, and
 * `PROMO_MUSIC=/path/to/track.mp3` when there is a real one.
 *
 * Usage: node tools/promo-video/music.mjs <seconds> [out.wav]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const RATE = 44100

/** C major pentatonic: C D E G A. Nothing in it can sound wrong against the rest. */
const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0]
/** The arpeggio, as scale degrees. Rises, falls back, never resolves hard. */
const PATTERN = [0, 2, 4, 2, 3, 1, 3, 0]
const NOTE_SECONDS = 0.34
/** Under the arpeggio, two octaves down, holding still. */
const PAD = [130.81, 196.0]

/**
 * A struck note: instant attack, exponential decay, a little of the octave
 * above for the glassiness that makes it read as a music box rather than a
 * test tone.
 */
function pluck(t, frequency) {
  const envelope = Math.exp(-t * 3.4)
  const body = Math.sin(2 * Math.PI * frequency * t)
  const shimmer = 0.22 * Math.sin(2 * Math.PI * frequency * 2 * t) * Math.exp(-t * 6)
  return (body + shimmer) * envelope
}

export function render(seconds) {
  const samples = Math.floor(seconds * RATE)
  const left = new Float32Array(samples)
  const right = new Float32Array(samples)

  for (let index = 0; index < samples; index += 1) {
    const time = index / RATE
    let value = 0

    // The arpeggio. Each note keeps sounding after the next one starts, so the
    // tail of one overlaps the attack of the next; that overlap is most of
    // what stops it sounding like a sequence of beeps.
    const step = Math.floor(time / NOTE_SECONDS)
    for (const back of [0, 1, 2]) {
      const which = step - back
      if (which < 0) continue
      const degree = PATTERN[which % PATTERN.length]
      const octave = Math.floor(which / PATTERN.length) % 2 === 1 ? 2 : 1
      value += 0.3 * pluck(time - which * NOTE_SECONDS, SCALE[degree] * octave)
    }

    // The pad: two sines a fifth apart, breathing slowly so it is not a drone.
    const breath = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.08 * time)
    for (const frequency of PAD) {
      value += 0.06 * (0.7 + 0.3 * breath) * Math.sin(2 * Math.PI * frequency * time)
    }

    // In over a second, out over the last two, so nothing starts or stops.
    const fadeIn = Math.min(1, time / 1.2)
    const fadeOut = Math.min(1, Math.max(0, (seconds - time) / 2))
    value *= fadeIn * fadeOut * 0.5

    // A few milliseconds of delay on one side is the whole stereo image.
    const offset = Math.floor(0.012 * RATE)
    left[index] = value
    if (index + offset < samples) right[index + offset] = value * 0.85
  }

  return { left, right, samples }
}

/** 16-bit PCM, because every consumer of a WAV understands it. */
function wav({ left, right, samples }) {
  const bytes = samples * 4
  const buffer = Buffer.alloc(44 + bytes)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + bytes, 4)
  buffer.write('WAVEfmt ', 8)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(2, 22)
  buffer.writeUInt32LE(RATE, 24)
  buffer.writeUInt32LE(RATE * 4, 28)
  buffer.writeUInt16LE(4, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(bytes, 40)

  for (let index = 0; index < samples; index += 1) {
    const clamp = (value) => Math.max(-1, Math.min(1, value)) * 32767
    buffer.writeInt16LE(Math.round(clamp(left[index])), 44 + index * 4)
    buffer.writeInt16LE(Math.round(clamp(right[index])), 46 + index * 4)
  }
  return buffer
}

export function writeBed(seconds, out = join(HERE, 'out/bed.wav')) {
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, wav(render(seconds)))
  return out
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*\//, ''))) {
  const seconds = Number(process.argv[2] ?? 20)
  console.log(`bed: ${writeBed(seconds, process.argv[3])} (${seconds}s)`)
}
