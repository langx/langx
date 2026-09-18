/**
 * Writes a music bed to `out/bed.wav`, as many seconds long as asked for.
 *
 * Synthesised here rather than shipped as a file, because a repository that is
 * public cannot carry somebody else's track and a track nobody has licensed
 * cannot go under an advert. Three styles, none of them ambitious: a bed for a
 * twenty-second product clip has to sit under the picture and end without
 * anybody noticing either.
 *
 * The better bed is the one Instagram or TikTok adds itself, from its own
 * licensed library, at upload time — that is what they promote and what cannot
 * get a post muted. Use one of these for the cut you are reviewing, and
 * `PROMO_MUSIC=/path/to/track.mp3` when there is a real one.
 *
 * Usage: node tools/promo-video/music.mjs <seconds> [out.wav] [style]
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const RATE = 44100

export const STYLES = ['warm', 'lofi', 'pulse']
const DEFAULT_STYLE = process.env.PROMO_MUSIC_STYLE ?? 'warm'

/**
 * Four bars of Am - F - C - G, which is four chords that cannot go wrong and
 * never resolve hard enough to sound like an ending in the middle of a video.
 * Each entry is a root and the two notes above it, in hertz.
 */
const BARS = [
  [220.0, 261.63, 329.63], // Am
  [174.61, 220.0, 261.63], // F
  [261.63, 329.63, 392.0], // C
  [196.0, 246.94, 293.66], // G
]
const BAR_SECONDS = 3.0

/** A soft electric-piano note: two detuned partials, quick in, slow out. */
function key(t, frequency) {
  if (t < 0) return 0
  const attack = Math.min(1, t / 0.02)
  const envelope = attack * Math.exp(-t * 1.1)
  const detune = Math.sin(2 * Math.PI * (frequency * 1.004) * t) * 0.5
  const body = Math.sin(2 * Math.PI * frequency * t) + detune
  const bell = 0.18 * Math.sin(2 * Math.PI * frequency * 3 * t) * Math.exp(-t * 5)
  return (body + bell) * envelope
}

/** The root, two octaves down, with a slow enough attack to be felt not heard. */
function sub(t, frequency) {
  if (t < 0) return 0
  return Math.sin(2 * Math.PI * (frequency / 4) * t) * Math.min(1, t / 0.15) * Math.exp(-t * 0.45)
}

/** A kick: pitch falling from 110Hz to the floor inside a tenth of a second. */
function kick(t) {
  if (t < 0 || t > 0.4) return 0
  const frequency = 50 + 70 * Math.exp(-t * 26)
  return Math.sin(2 * Math.PI * frequency * t) * Math.exp(-t * 11)
}

/** A hat: noise, gone almost before it arrives. */
function hat(t, seed) {
  if (t < 0 || t > 0.08) return 0
  // Deterministic noise, so two runs of this file produce the same bytes.
  const noise = Math.sin(seed * 12.9898 + t * 78233.0) * 43758.5453
  return (noise - Math.floor(noise) - 0.5) * 2 * Math.exp(-t * 60)
}

export function render(seconds, style = DEFAULT_STYLE) {
  const samples = Math.floor(seconds * RATE)
  const left = new Float32Array(samples)
  const right = new Float32Array(samples)
  const beat = BAR_SECONDS / 4

  // One-pole low pass, run over the mix: without it the partials above sit on
  // top of the speech-shaped part of the spectrum, which is where a voiceover
  // or a platform's own captions would have to live.
  let previous = 0
  const cutoff = style === 'lofi' ? 0.22 : 0.3

  for (let index = 0; index < samples; index += 1) {
    const time = index / RATE
    const bar = Math.floor(time / BAR_SECONDS) % BARS.length
    const chord = BARS[bar]
    const intoBar = time - Math.floor(time / BAR_SECONDS) * BAR_SECONDS
    let value = 0

    if (style === 'pulse') {
      // One note of the chord per eighth, walking up and back down.
      const step = Math.floor(intoBar / (beat / 2))
      const walk = [0, 1, 2, 1, 2, 1, 0, 1]
      for (const back of [0, 1]) {
        const which = step - back
        if (which < 0) continue
        value += 0.26 * key(intoBar - which * (beat / 2), chord[walk[which % walk.length]])
      }
      value += 0.5 * sub(intoBar, chord[0])
    } else {
      // The chord, struck on the bar and left to ring.
      for (const [voice, frequency] of chord.entries()) {
        value += 0.22 * key(intoBar - voice * 0.012, frequency)
      }
      value += 0.55 * sub(intoBar, chord[0])
    }

    if (style === 'lofi') {
      value += 0.5 * kick(intoBar) + 0.5 * kick(intoBar - beat * 2)
      for (const eighth of [1, 3, 5, 7]) {
        value += 0.035 * hat(intoBar - eighth * (beat / 2), eighth)
      }
    }

    previous += cutoff * (value - previous)
    let mixed = previous

    // In over a second and a half, out over the last two, so the bed neither
    // starts nor stops — it is already there and then it is not.
    mixed *= Math.min(1, time / 1.5) * Math.min(1, Math.max(0, (seconds - time) / 2)) * 0.62

    const offset = Math.floor(0.014 * RATE)
    left[index] = mixed
    if (index + offset < samples) right[index + offset] = mixed * 0.88
  }

  /*
   * Normalised to a fixed peak, so the three styles are interchangeable.
   * Without it a kick in one of them peaks nine decibels above the chords in
   * another, and the gain in `compose.mjs` would have to be picked per style.
   */
  // A loop, not `Math.max(...samples)`: a million arguments overflows the stack.
  let peak = 1e-6
  for (let index = 0; index < samples; index += 1) {
    peak = Math.max(peak, Math.abs(left[index]), Math.abs(right[index]))
  }
  const gain = 0.5 / peak
  for (let index = 0; index < samples; index += 1) {
    left[index] *= gain
    right[index] *= gain
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

export function writeBed(seconds, out = join(HERE, 'out/bed.wav'), style = DEFAULT_STYLE) {
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, wav(render(seconds, style)))
  return out
}

if (process.argv[1] && process.argv[1].endsWith('music.mjs')) {
  const seconds = Number(process.argv[2] ?? 20)
  const style = process.argv[4] ?? DEFAULT_STYLE
  console.log(`bed: ${writeBed(seconds, process.argv[3], style)} (${seconds}s, ${style})`)
}
