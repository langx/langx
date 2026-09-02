import { describe, expect, it } from 'vitest'
import { dropdownLayout } from './dropdownLayout'

const screen = { width: 400, height: 800 }
const insets = { top: 50, bottom: 30 }
const menu = { width: 160, height: 120 }
const at = (x: number, y: number) => ({ x, y, width: 90, height: 20 })

describe('dropdownLayout', () => {
  it('drops below the control, just under it', () => {
    const layout = dropdownLayout({ anchor: at(20, 100), screen, insets, menu })
    expect(layout.placement).toBe('below')
    expect(layout.top).toBe(126)
    expect(layout.left).toBe(20)
  })

  it('flips above when below would run past the bottom', () => {
    const layout = dropdownLayout({ anchor: at(20, 700), screen, insets, menu })
    expect(layout.placement).toBe('above')
    expect(layout.top).toBe(574)
  })

  /**
   * A control low on a short screen: neither arrangement fits. Below wins and
   * the end is cut off, because flipping above would put the first option off
   * the top of the screen — unreachable rather than merely clipped.
   */
  it('stays below when neither side fits, clamped into the safe area', () => {
    const tiny = { width: 400, height: 200 }
    const layout = dropdownLayout({ anchor: at(20, 150), screen: tiny, insets, menu })
    expect(layout.placement).toBe('below')
    expect(layout.top).toBe(62)
  })

  it('pulls a menu near the right edge back inside the screen', () => {
    const layout = dropdownLayout({ anchor: at(330, 100), screen, insets, menu })
    expect(layout.left).toBe(228)
  })

  it('starts at the gutter when the menu is wider than the screen', () => {
    const wide = { width: 500, height: 120 }
    const layout = dropdownLayout({ anchor: at(20, 100), screen, insets, menu: wide })
    expect(layout.left).toBe(12)
  })
})
