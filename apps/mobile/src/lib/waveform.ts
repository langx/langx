import { WAVEFORM_PEAK } from '@langx/shared'

/**
 * The geometry of a voice note's bars, kept free of `react-native` so it can
 * be tested without a renderer. `AudioBubble` draws what this returns.
 */

/** Pixels. Thin bars with gaps as wide, which is what reads as a waveform at this size. */
export const WAVEFORM_BAR_WIDTH = 2
export const WAVEFORM_BAR_GAP = 2

/**
 * The shortest bar, as a share of the full height. A slice of silence still
 * draws a dot, so the row reads as one track from end to end rather than as
 * bars with holes between them.
 */
const MIN_BAR = 0.12
/**
 * Every bar of a note with no stored waveform: those sent before the server
 * read one, a host with no ffmpeg, an Echo card's own recording. Even and low,
 * so it reads as a track to play along rather than a shape that means
 * something it does not.
 */
const FLAT_BAR = 0.3

/** How many bars fit a width, whole bars only. */
export function waveformBarCount(width: number): number {
  if (width <= 0) return 0
  return Math.floor((width + WAVEFORM_BAR_GAP) / (WAVEFORM_BAR_WIDTH + WAVEFORM_BAR_GAP))
}

/**
 * The height of each of `count` bars, from 0 to 1.
 *
 * The stored waveform has a fixed length and a bubble has whatever width it
 * was given, so this resamples: each drawn bar takes the loudest of the stored
 * values it covers, which keeps a short syllable from vanishing when a narrow
 * bubble squeezes several into one bar. Wider than the data, a value simply
 * repeats.
 */
export function waveformBars(waveform: readonly number[] | undefined, count: number): number[] {
  if (count <= 0) return []
  if (!waveform?.length) return Array.from({ length: count }, () => FLAT_BAR)

  const length = waveform.length
  return Array.from({ length: count }, (_, bar) => {
    const start = Math.floor((bar * length) / count)
    const end = Math.max(start + 1, Math.floor(((bar + 1) * length) / count))
    const peak = Math.max(...waveform.slice(start, end))
    // Clamped as well as floored: the row is the server's, but a bar taller
    // than its box is a layout bug nobody would trace back here.
    return Math.min(1, Math.max(MIN_BAR, peak / WAVEFORM_PEAK))
  })
}

/**
 * How many bars, from the left, count as played.
 *
 * `null` is a note whose length nobody knows — v1's, see `audioProgress` — and
 * shows none played rather than a position it cannot know.
 */
export function playedBarCount(fraction: number | null, count: number): number {
  if (fraction === null) return 0
  return Math.round(Math.min(1, Math.max(0, fraction)) * count)
}

/**
 * Where in the note a touch at `x` points, from 0 to 1.
 *
 * Clamped, because a drag carries on past either end of the bars and should
 * hold at the start or the end rather than seek to a negative second.
 */
export function seekFraction(x: number, width: number): number {
  if (width <= 0) return 0
  return Math.min(1, Math.max(0, x / width))
}

/**
 * Further from the player's position than this, and the v3 sweep jumps to it
 * rather than running on from where it was: that is a seek or a replay, not
 * the few hundredths two clocks drift apart by between status updates.
 */
const SWEEP_SNAP = 0.03

export interface SweepPlan {
  /** Where to put the sweep at once, or `null` to carry on from where it is. */
  from: number | null
  /** How long to run on to the end, linearly, in ms. `0` holds it at `from`. */
  ms: number
}

/**
 * How the v3 voice-note sweep (`WaveformProgress`) follows the player.
 *
 * The status arrives a few times a second, so drawing it as it comes is a
 * bar that steps. Each status instead restarts one linear run to the end,
 * timed by the real time left, and the sweep moves every frame at the speed
 * the note plays. Continuing from where the sweep already is, rather than
 * snapping to the status first, makes each update a tiny change of speed
 * instead of a visible hop back or forth.
 *
 * `secondsLeft` is wall-clock time, already divided by the playback rate.
 */
export function sweepPlan(
  current: number,
  at: number | null,
  playing: boolean,
  secondsLeft: number,
): SweepPlan {
  if (at === null) return { from: 0, ms: 0 }
  if (!playing || secondsLeft <= 0) return { from: at, ms: 0 }
  return { from: Math.abs(current - at) > SWEEP_SNAP ? at : null, ms: secondsLeft * 1000 }
}
