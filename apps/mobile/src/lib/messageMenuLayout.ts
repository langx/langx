import type { AnchorRect } from './messageMenu'

export interface MenuLayoutInput {
  anchor: AnchorRect
  screen: { width: number; height: number }
  insets: { top: number; bottom: number }
  menu: { width: number; height: number }
  strip: { width: number; height: number }
  /** Own messages hang off the right edge, the other person's off the left. */
  mine: boolean
}

export interface MenuLayout {
  /** Where the *menu* went. The strip always takes the opposite side. */
  placement: 'below' | 'above'
  strip: { top: number; left: number }
  menu: { top: number; left: number }
  /**
   * Where to draw the copy of the bubble.
   *
   * An output, not the measured rect it came in as: when neither arrangement
   * fits — a tall bubble on a short screen — the whole stack is centred in the
   * safe area, and the bubble has to move with it.
   */
  bubble: { top: number; left: number }
}

const GUTTER = 12
const GAP = 8

/**
 * Where the strip, the bubble and the menu go once a bubble has been pressed.
 *
 * Pure, and given the menu's height rather than left to measure it: measuring
 * after mounting means one frame drawn in the wrong place and a visible jump
 * on exactly the gesture that is supposed to feel immediate. Deriving the
 * height from the row count decides the flip before the first paint, and keeps
 * every one of these rules testable without a renderer.
 */
export function messageMenuLayout(input: MenuLayoutInput): MenuLayout {
  const { anchor, screen, insets, menu, strip, mine } = input

  const safeTop = insets.top + GUTTER
  const safeBottom = screen.height - insets.bottom - GUTTER

  const align = (width: number): number => {
    const preferred = mine ? anchor.x + anchor.width - width : anchor.x
    const most = Math.max(GUTTER, screen.width - width - GUTTER)
    return Math.min(Math.max(preferred, GUTTER), most)
  }

  // Preferred: the strip sits over the bubble and the menu under it, which is
  // the order the thumb meets them coming up from the composer.
  const belowTop = anchor.y - GAP - strip.height
  const belowBottom = anchor.y + anchor.height + GAP + menu.height
  const fitsBelow = belowTop >= safeTop && belowBottom <= safeBottom

  // Near the bottom of the screen the menu has nowhere to go, so the two swap.
  const aboveTop = anchor.y - GAP - menu.height
  const aboveBottom = anchor.y + anchor.height + GAP + strip.height
  const fitsAbove = aboveTop >= safeTop && aboveBottom <= safeBottom

  const stripLeft = align(strip.width)
  const menuLeft = align(menu.width)
  const bubbleLeft = anchor.x

  if (fitsBelow || !fitsAbove) {
    // The fallback branch too: neither fits, so the whole stack is centred in
    // the safe area and the bubble moves off its measured position with it.
    const total = strip.height + GAP + anchor.height + GAP + menu.height
    const stackTop = fitsBelow
      ? belowTop
      : // Clamped bottom-first, then top: a stack taller than the safe area
        // fits nowhere, and pinning it to the top at least leaves the strip and
        // the bubble reachable. The other order pushes both off the top instead.
        Math.max(safeTop, Math.min((safeTop + safeBottom - total) / 2, safeBottom - total))
    const bubbleTop = stackTop + strip.height + GAP

    return {
      placement: 'below',
      strip: { top: stackTop, left: stripLeft },
      bubble: { top: bubbleTop, left: bubbleLeft },
      menu: { top: bubbleTop + anchor.height + GAP, left: menuLeft },
    }
  }

  return {
    placement: 'above',
    menu: { top: aboveTop, left: menuLeft },
    bubble: { top: anchor.y, left: bubbleLeft },
    strip: { top: anchor.y + anchor.height + GAP, left: stripLeft },
  }
}
