import { describe, expect, it } from 'vitest'
import { messageMenuLayout, type MenuLayoutInput } from './messageMenuLayout'

const BASE: MenuLayoutInput = {
  anchor: { x: 40, y: 400, width: 240, height: 60 },
  screen: { width: 400, height: 800 },
  insets: { top: 48, bottom: 34 },
  menu: { width: 220, height: 200 },
  strip: { width: 300, height: 48 },
  mine: false,
}

const layout = (overrides: Partial<MenuLayoutInput> = {}) =>
  messageMenuLayout({ ...BASE, ...overrides })

describe('messageMenuLayout', () => {
  it('puts the strip over the bubble and the menu under it when there is room', () => {
    const result = layout()
    expect(result.placement).toBe('below')
    expect(result.strip.top).toBeLessThan(result.bubble.top)
    expect(result.menu.top).toBeGreaterThan(result.bubble.top)
    // The bubble stays exactly where it was measured.
    expect(result.bubble.top).toBe(BASE.anchor.y)
  })

  /** Near the bottom the menu has nowhere to go, so the two swap. */
  it('flips the menu above the bubble against the bottom of the screen', () => {
    const result = layout({ anchor: { x: 40, y: 600, width: 240, height: 60 } })
    expect(result.placement).toBe('above')
    expect(result.menu.top).toBeLessThan(result.bubble.top)
    expect(result.strip.top).toBeGreaterThan(result.bubble.top)
  })

  it('keeps the flipped menu clear of the top inset', () => {
    const result = layout({ anchor: { x: 40, y: 600, width: 240, height: 60 } })
    expect(result.menu.top).toBeGreaterThanOrEqual(BASE.insets.top)
  })

  it('hangs the menu off the right of your own bubble and the left of theirs', () => {
    const anchor = { x: 120, y: 400, width: 240, height: 60 }
    expect(layout({ anchor, mine: false }).menu.left).toBe(120)
    // Right edges line up: 120 + 240 - 220.
    expect(layout({ anchor, mine: true }).menu.left).toBe(140)
  })

  it('never lets the strip leave the screen on either side', () => {
    const offRight = layout({ anchor: { x: 380, y: 400, width: 240, height: 60 }, mine: true })
    expect(offRight.strip.left + BASE.strip.width).toBeLessThanOrEqual(BASE.screen.width)

    const offLeft = layout({ anchor: { x: -20, y: 400, width: 240, height: 60 } })
    expect(offLeft.strip.left).toBeGreaterThanOrEqual(0)
  })

  /**
   * A tall bubble on a short screen fits neither way round, and the bubble
   * moving off its measured position is the price of showing the whole stack.
   */
  it('centres the whole stack when neither arrangement fits', () => {
    const result = layout({
      anchor: { x: 40, y: 300, width: 240, height: 260 },
      screen: { width: 400, height: 640 },
    })
    expect(result.strip.top).toBeGreaterThanOrEqual(BASE.insets.top)
    expect(result.menu.top + BASE.menu.height).toBeLessThanOrEqual(640 - BASE.insets.bottom)
    expect(result.bubble.top).not.toBe(300)
  })

  it('keeps the three in order whichever way it lands', () => {
    for (const y of [100, 300, 500, 700]) {
      const result = layout({ anchor: { x: 40, y, width: 240, height: 60 } })
      const [first, second] =
        result.placement === 'below'
          ? [result.strip.top, result.menu.top]
          : [result.menu.top, result.strip.top]
      expect(first).toBeLessThan(result.bubble.top)
      expect(second).toBeGreaterThan(result.bubble.top)
    }
  })
})

describe('right-to-left layouts', () => {
  const base = {
    screen: { width: 400, height: 800 },
    insets: { top: 50, bottom: 30 },
    menu: { width: 220, height: 200 },
    strip: { width: 300, height: 48 },
  }
  // Mid-screen, so neither branch is decided by an edge clamp.
  const anchor = { x: 120, y: 300, width: 200, height: 60 }

  it('hangs an own message off the left edge instead of the right', () => {
    const ltr = messageMenuLayout({ ...base, anchor, mine: true })
    const rtl = messageMenuLayout({ ...base, anchor, mine: true, rtl: true })

    expect(ltr.menu.left).toBe(anchor.x + anchor.width - base.menu.width)
    expect(rtl.menu.left).toBe(anchor.x)
  })

  it('hangs the other person’s off the right edge instead of the left', () => {
    const ltr = messageMenuLayout({ ...base, anchor, mine: false })
    const rtl = messageMenuLayout({ ...base, anchor, mine: false, rtl: true })

    expect(ltr.menu.left).toBe(anchor.x)
    expect(rtl.menu.left).toBe(anchor.x + anchor.width - base.menu.width)
  })

  it('leaves the vertical arrangement alone — only the edge flips', () => {
    const ltr = messageMenuLayout({ ...base, anchor, mine: true })
    const rtl = messageMenuLayout({ ...base, anchor, mine: true, rtl: true })

    expect(rtl.placement).toBe(ltr.placement)
    expect(rtl.menu.top).toBe(ltr.menu.top)
    expect(rtl.strip.top).toBe(ltr.strip.top)
  })

  it('defaults to left-to-right when nothing says otherwise', () => {
    expect(messageMenuLayout({ ...base, anchor, mine: true })).toEqual(
      messageMenuLayout({ ...base, anchor, mine: true, rtl: false }),
    )
  })
})
