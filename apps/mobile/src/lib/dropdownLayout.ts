export interface AnchorRect {
  x: number
  y: number
  width: number
  height: number
}

export interface DropdownLayoutInput {
  /** Where the control that opened it sits, in window coordinates. */
  anchor: AnchorRect
  screen: { width: number; height: number }
  insets: { top: number; bottom: number }
  /** Measured from the option count before the first paint — see below. */
  menu: { width: number; height: number }
}

export interface DropdownLayout {
  placement: 'below' | 'above'
  top: number
  left: number
}

const GUTTER = 12
const GAP = 6

/**
 * Where a dropdown goes once its control has been pressed.
 *
 * Pure, and given the menu's height rather than left to measure its own: a
 * height measured after mounting means one frame drawn in the wrong place and
 * a visible jump on exactly the gesture that is supposed to feel immediate.
 * Deciding the flip from the row count settles it before the first paint, and
 * keeps these rules testable without a renderer — the same split, and for the
 * same reason, as `messageMenuLayout`.
 *
 * Below the control by default, because that is what "drops down" means and it
 * keeps the control itself visible. Above only when below would run past the
 * safe area.
 *
 * When neither side fits — a short screen, or the keyboard having taken half
 * of it — the menu is pulled back inside the safe area instead, overlapping
 * the control if it has to. Covering the word you just tapped is worth it: the
 * alternative is a menu whose first option is off-screen, which reads as
 * nothing having happened.
 */
export function dropdownLayout(input: DropdownLayoutInput): DropdownLayout {
  const { anchor, screen, insets, menu } = input

  const safeTop = insets.top + GUTTER
  const safeBottom = screen.height - insets.bottom - GUTTER

  const below = anchor.y + anchor.height + GAP
  const above = anchor.y - GAP - menu.height
  const placement: DropdownLayout['placement'] =
    below + menu.height <= safeBottom || above < safeTop ? 'below' : 'above'

  // Clamped both ways. `min` first so a menu that would overrun the bottom is
  // pulled up; `max` last so the pull can never push its first row off the top.
  const wanted = placement === 'below' ? below : above
  const top = Math.max(safeTop, Math.min(wanted, safeBottom - menu.height))

  // Aligned to the control's leading edge, then pulled back inside the screen.
  // `Math.max` last so a menu wider than the screen still starts at the gutter
  // rather than at a negative offset.
  const left = Math.max(GUTTER, Math.min(anchor.x, screen.width - GUTTER - menu.width))

  return { placement, top, left }
}
