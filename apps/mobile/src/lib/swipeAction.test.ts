import { describe, expect, it } from 'vitest'
import {
  ACTION_LOCK_PX,
  ACTION_WIDTH_PX,
  drawerWidth,
  rowSwipeEnabled,
  rowTranslation,
  settleOffset,
  shouldCaptureRowSwipe,
} from './swipeAction'

const ONE = drawerWidth(1)
const TWO = drawerWidth(2)

describe('shouldCaptureRowSwipe', () => {
  it('ignores movement that has not committed yet', () => {
    expect(shouldCaptureRowSwipe(ACTION_LOCK_PX, 0)).toBe(false)
    expect(shouldCaptureRowSwipe(-ACTION_LOCK_PX, 0)).toBe(false)
  })

  it('takes a clear horizontal drag either way', () => {
    expect(shouldCaptureRowSwipe(40, 5)).toBe(true)
    expect(shouldCaptureRowSwipe(-40, 5)).toBe(true)
  })

  /**
   * The whole answer to "why does the list not scroll any more". A flick down a
   * long list is never perfectly vertical.
   */
  it('leaves a diagonal flick to the list', () => {
    expect(shouldCaptureRowSwipe(30, 30)).toBe(false)
    expect(shouldCaptureRowSwipe(-30, 25)).toBe(false)
  })
})

describe('drawerWidth', () => {
  it('is one width per button', () => {
    expect(drawerWidth(1)).toBe(ACTION_WIDTH_PX)
    expect(drawerWidth(2)).toBe(ACTION_WIDTH_PX * 2)
  })

  it('is nothing for a side with no actions', () => {
    expect(drawerWidth(0)).toBe(0)
  })
})

describe('rowTranslation', () => {
  it('follows the finger up to the drawer it is opening', () => {
    expect(rowTranslation(50, ONE, TWO)).toBe(50)
    expect(rowTranslation(-50, ONE, TWO)).toBe(-50)
    expect(rowTranslation(ONE, ONE, TWO)).toBe(ONE)
  })

  it('resists past a fully open drawer rather than stopping dead', () => {
    const over = rowTranslation(ONE + 100, ONE, TWO)
    expect(over).toBeGreaterThan(ONE)
    expect(over).toBeLessThan(ONE + 100)
  })

  /** Two buttons is twice the room, so the same pull is still inside it. */
  it('lets the wider side travel further before resisting', () => {
    expect(rowTranslation(-TWO, ONE, TWO)).toBe(-TWO)
    expect(rowTranslation(TWO, ONE, TWO)).toBeLessThan(TWO)
  })

  it('gives a side with no actions nothing but rubber', () => {
    expect(rowTranslation(100, 0, TWO)).toBeLessThan(20)
  })
})

describe('settleOffset', () => {
  it('opens once the pull is far enough in', () => {
    expect(settleOffset(-TWO, ONE, TWO)).toBe(-TWO)
    expect(settleOffset(ONE, ONE, TWO)).toBe(ONE)
  })

  /** A short pull closes again — nothing is fired, and nothing is left ajar. */
  it('closes again when it stopped short', () => {
    expect(settleOffset(-10, ONE, TWO)).toBe(0)
    expect(settleOffset(10, ONE, TWO)).toBe(0)
    expect(settleOffset(0, ONE, TWO)).toBe(0)
  })

  /** Half-open is a row whose buttons are half-tappable. */
  it('never rests part-way', () => {
    for (const x of [-160, -80, -30, 30, 80, 160]) {
      expect([0, ONE, -TWO]).toContain(settleOffset(x, ONE, TWO))
    }
  })

  it('cannot open a side that has no actions', () => {
    expect(settleOffset(300, 0, TWO)).toBe(0)
    expect(settleOffset(-300, ONE, 0)).toBe(0)
  })
})

describe('rowSwipeEnabled', () => {
  it('is on natively and on a touchscreen browser', () => {
    expect(rowSwipeEnabled('ios', false)).toBe(true)
    expect(rowSwipeEnabled('android', false)).toBe(true)
    expect(rowSwipeEnabled('web', true)).toBe(true)
  })

  /** A mouse drag across a row is also text selection; the two fight. */
  it('is off in a browser driven by a mouse', () => {
    expect(rowSwipeEnabled('web', false)).toBe(false)
  })
})
