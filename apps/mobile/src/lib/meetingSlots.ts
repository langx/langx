/**
 * The choices "Propose a time" offers, shared by its current page and its v3
 * twin so the two cannot offer different slots.
 */

/** An hour ahead, rounded up to the next half hour. */
export function defaultStart(): Date {
  const at = new Date(Date.now() + 60 * 60 * 1000)
  at.setMinutes(at.getMinutes() > 30 ? 60 : 30, 0, 0)
  // Late enough at night that the row has no slot for it: the next morning is
  // the honest answer, and it keeps the chosen chip on a chip that exists.
  if (at.getHours() < FIRST_HOUR) at.setHours(FIRST_HOUR, 0, 0, 0)
  return at
}

/**
 * Half hours from seven in the morning to midnight.
 *
 * Not all forty-eight: nobody proposes a language exchange at 3 a.m., and the
 * ones nobody picks are the ones you scroll past to reach the ones you do.
 */
export const FIRST_HOUR = 7
export const SLOTS = Array.from({ length: (24 - FIRST_HOUR) * 2 }, (_, i) => ({
  hour: FIRST_HOUR + Math.floor(i / 2),
  minute: (i % 2) * 30,
}))

/**
 * Roughly a chip's width plus its gap, used to open the row on the chosen
 * time rather than at seven in the morning. An estimate on purpose — the real
 * width depends on the locale's clock — and being a little off only means the
 * selected chip sits a little off centre, which is what a scroll fixes.
 */
export const SLOT_WIDTH = 78
