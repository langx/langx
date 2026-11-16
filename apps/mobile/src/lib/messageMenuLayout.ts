import type { AnchorRect } from './messageMenu'

export interface MenuLayoutInput {
  anchor: AnchorRect
  screen: { width: number; height: number }
  insets: { top: number; bottom: number }
  menu: { width: number; height: number }
  strip: { width: number; height: number }
  /** Own messages hang off the right edge, the other person's off the left. */
  mine: boolean
  /**
   * Whether the layout around this menu is right to left.
   *
   * `mine` alone is not enough, and the reason is easy to miss: it names the
   * *sender*, and the caller reads the edge to align to off it. In an RTL
   * layout your own bubbles sit on the left, so "mine → right edge" silently
   * becomes "mine → the far side of the bubble" — a menu hanging off the wrong
   * corner, which reads on screen as a positioning bug rather than as an RTL
   * one. The two facts are separated here so the flip is a rule with a test
   * rather than an assumption baked into an arithmetic expression.
   */
  rtl?: boolean
}

export interface MenuLayout {
  /** Where the *menu* went. The strip always takes the opposite side. */
  placement: 'below' | 'above'
  strip: { top: number; left: number }
  /**
   * `height` is the input's unless not even the menu fits the safe area — a
   * short browser window — and then the caller has to let the rows scroll.
   */
  menu: { top: number; left: number; height: number }
  /**
   * Where to draw the copy of the bubble, and how much of it.
   *
   * An output, not the measured rect it came in as: when neither arrangement
   * fits — a tall bubble on a short screen — the whole stack is centred in the
   * safe area, and the bubble has to move with it. When the stack is taller
   * than the safe area the copy is also cut to the room between the strip and
   * the menu, so the caller has to clip it to `height`.
   */
  bubble: { top: number; left: number; height: number }
}

const GUTTER = 12
/**
 * Between the strip, the bubble and the menu. The bubble is being *lifted* out
 * of the thread, and at 8 the menu read as glued to its underside rather than
 * as a second surface — the same 12 the screen keeps at its edges.
 */
const GAP = 12
/**
 * The least of the copy kept when the stack is cut down: about one line of a
 * bubble, enough to still say which message the menu is for.
 */
const LEAST_COPY = 44

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
  const { anchor, screen, insets, menu, strip, mine, rtl = false } = input

  const safeTop = insets.top + GUTTER
  const safeBottom = screen.height - insets.bottom - GUTTER

  // Which side of the bubble the menu hangs from. `mine !== rtl` because
  // both flips together are no flip: an own message in an RTL layout aligns
  // to the same near edge as the other person's message in an LTR one.
  const alignToTrailingEdge = mine !== rtl

  const align = (width: number): number => {
    const preferred = alignToTrailingEdge ? anchor.x + anchor.width - width : anchor.x
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

  const total = strip.height + GAP + anchor.height + GAP + menu.height

  if (fitsBelow || (!fitsAbove && total <= safeBottom - safeTop)) {
    // The fallback branch too: neither fits, so the whole stack is centred in
    // the safe area and the bubble moves off its measured position with it.
    const stackTop = fitsBelow ? belowTop : (safeTop + safeBottom - total) / 2
    const bubbleTop = stackTop + strip.height + GAP

    return {
      placement: 'below',
      strip: { top: stackTop, left: stripLeft },
      bubble: { top: bubbleTop, left: bubbleLeft, height: anchor.height },
      menu: { top: bubbleTop + anchor.height + GAP, left: menuLeft, height: menu.height },
    }
  }

  if (!fitsAbove) {
    /*
     * Taller than the safe area: something has to give, and it is the copy.
     * The menu is the only part of this that gets pressed — the copy is a
     * picture of what was pressed — so the strip keeps the top, the menu keeps
     * the bottom and the copy gets what is left between them. This used to pin
     * the stack to the top at the bubble's full height instead, and a long
     * message pushed every row past the first two under the bottom edge.
     */
    const bubbleTop = safeTop + strip.height + GAP
    const room = safeBottom - safeTop - strip.height - GAP - GAP - menu.height
    const bubbleHeight = Math.min(anchor.height, Math.max(room, LEAST_COPY))
    const menuTop = bubbleTop + bubbleHeight + GAP

    return {
      placement: 'below',
      strip: { top: safeTop, left: stripLeft },
      bubble: { top: bubbleTop, left: bubbleLeft, height: bubbleHeight },
      menu: { top: menuTop, left: menuLeft, height: Math.min(menu.height, safeBottom - menuTop) },
    }
  }

  return {
    placement: 'above',
    menu: { top: aboveTop, left: menuLeft, height: menu.height },
    bubble: { top: anchor.y, left: bubbleLeft, height: anchor.height },
    strip: { top: anchor.y + anchor.height + GAP, left: stripLeft },
  }
}
