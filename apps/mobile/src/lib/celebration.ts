/**
 * The rules a celebration keeps, as numbers and one small ledger, apart from
 * `CelebrationSheet` and `Confetti` so they can be tested.
 *
 * v3's brief: a celebration lasts at most 1.5 s, is skippable with one tap,
 * never blocks the next action and appears once per event. The first and the
 * last are decided here — the rain's timing has to fit inside the window, and
 * an event that has already been celebrated in this run of the app is not
 * celebrated again.
 */

/** The whole of a celebration's motion, from the first frame to the last piece landing. */
export const CELEBRATION_MS = 1500

/** Each as `[shortest, longest]`. */
export interface RainStyle {
  /** When a piece starts falling, from the moment the rain is drawn. */
  delay: readonly [number, number]
  /** How long it takes to fall. */
  fall: readonly [number, number]
  /** Its size, a glyph's font size or a flat piece's longer side. */
  size: readonly [number, number]
  /** How far it turns on the way down, either way, in degrees. */
  spin: number
}

export const RAIN = {
  /**
   * The Pro welcome's emoji shower, exactly as it was when it lived inside
   * `ProWelcomeHost`. It runs past `CELEBRATION_MS`: it is the current look
   * and predates the rule, and it moves to the v3 timing with the screen.
   */
  welcome: { delay: [250, 1150], fall: [1900, 3200], size: [22, 36], spin: 300 },
  /**
   * v3's: everything has landed by `CELEBRATION_MS`. The first piece still
   * waits a beat, which is what keeps the rain off screen while
   * `useReduceMotion` is answering — it starts at "motion is fine", and a
   * piece already falling when it says otherwise would be exactly the
   * movement somebody asked not to see.
   */
  celebration: { delay: [150, 450], fall: [800, 1050], size: [8, 14], spin: 540 },
} as const satisfies Record<string, RainStyle>

export interface Drop {
  /** Which of the pieces it draws, by position, wrapping round. */
  piece: number
  /** From the leading edge, so the rain covers the width whatever its direction. */
  start: number
  delay: number
  fall: number
  size: number
  spin: number
}

function between([low, high]: readonly [number, number], random: () => number): number {
  return low + random() * (high - low)
}

/**
 * `count` pieces spread across `width`, each with its own start, speed, size
 * and turn. `random` is `Math.random` in the app and a fixed sequence in tests.
 */
export function rainDrops(
  count: number,
  width: number,
  style: RainStyle,
  random: () => number = Math.random,
): Drop[] {
  return Array.from({ length: count }, (_, piece) => ({
    piece,
    // The largest a piece can be, so none hangs off the far edge.
    start: random() * Math.max(0, width - style.size[1]),
    delay: between(style.delay, random),
    fall: between(style.fall, random),
    size: between(style.size, random),
    spin: (random() - 0.5) * style.spin,
  }))
}

/** When the last piece of a rain has landed. */
export function rainEndsAt(drops: readonly Drop[]): number {
  return drops.reduce((end, drop) => Math.max(end, drop.delay + drop.fall), 0)
}

const celebrated = new Set<string>()

/**
 * True the first time an event is shown in this run of the app, and false
 * after that. The sheet plays its motion and its haptic only when this says
 * so: the same streak day reopened from a notification, or the sheet mounting
 * again under a re-render, is the card without the fanfare.
 *
 * Across launches the caller decides — a server acknowledgement, the way
 * `proWelcome` is cleared — because a celebration that is owed to the
 * person once must survive a reinstall, and this cannot.
 */
export function claimCelebration(eventId: string): boolean {
  if (celebrated.has(eventId)) return false
  celebrated.add(eventId)
  return true
}

/** Test seam: forgets every event. */
export function resetCelebrationsForTest(): void {
  celebrated.clear()
}
