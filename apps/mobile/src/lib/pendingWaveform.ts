/**
 * The bars a voice note draws while it is still on its way up.
 *
 * The real waveform is read by the server after the upload, so until then
 * there is nothing to draw but a stand-in. A flat row read as a progress bar
 * rather than as a voice note; a shape that changed on every render read as
 * a live meter. So: a fixed, speech-like contour, seeded by the row's client
 * id, so one note keeps its shape from the first frame to the last and two
 * notes side by side do not look like copies.
 *
 * Pure, so vitest can reach it; `PendingWaveformV3` draws what this returns.
 */

/** The quietest and loudest a stand-in bar may be, as a share of the full height. */
const LOW = 0.22
const HIGH = 0.9

/** FNV-1a over the string: a stable 32-bit seed from a client id. */
function hash(seed: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** mulberry32: small, fast and good enough to make bars look unplanned. */
function random(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * `count` heights from 0 to 1 for the note whose row has `seed` for an id.
 *
 * Each bar is averaged with the one before it, so neighbours rise and fall
 * together the way syllables do, instead of alternating like noise.
 */
export function pendingWaveform(seed: string, count: number): number[] {
  if (count <= 0) return []
  const next = random(hash(seed))
  const bars: number[] = []
  let previous = next()
  for (let i = 0; i < count; i++) {
    const raw = next()
    const smooth = (raw + previous) / 2
    previous = raw
    bars.push(LOW + smooth * (HIGH - LOW))
  }
  return bars
}
