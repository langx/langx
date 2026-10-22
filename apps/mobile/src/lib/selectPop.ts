/**
 * The selection pop's rules, apart from the hook so they can be tested.
 *
 * A choice that has just been made grows back from a little smaller on
 * `EASE_POP`, so the tick or the pill lands rather than appearing. Only on the
 * change: a row that mounts already chosen — a step reopened, a list scrolled
 * back to — was chosen some other time, and popping it would announce a
 * choice nobody just made. And never under reduce motion, where the chosen
 * look is simply there.
 */

/** How small a tick or a check starts: enough to read as arriving. */
export const POP_FROM_GLYPH = 0.6

/**
 * How small a whole pill starts. A pill is many times a tick's size, and at
 * 0.6 it would read as jumping out of the row rather than settling into it.
 */
export const POP_FROM_PILL = 0.9

export function shouldPop(wasSelected: boolean, selected: boolean, reduceMotion: boolean): boolean {
  return selected && !wasSelected && !reduceMotion
}
