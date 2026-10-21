import { describe, expect, it } from 'vitest'
import {
  DELAY,
  DURATION,
  LOOP,
  PRESS_SCALE,
  PRESS_SCALE_CARD,
  PRESS_SCALE_GLYPH,
} from './motionValues'

// `motion.ts` cannot load here (it imports Reanimated), so these pin the
// relationships its header promises on the numbers it is built from.
describe('motion values', () => {
  it('keeps every one-shot inside the recap pop, the longest thing a tap starts', () => {
    for (const ms of Object.values(DURATION)) expect(ms).toBeLessThanOrEqual(DURATION.pop)
  })

  it('leaves faster than it arrives', () => {
    expect(DURATION.exit).toBeLessThan(DURATION.enter)
  })

  it('keeps press feedback short enough to sit under the finger', () => {
    expect(DURATION.press).toBeLessThanOrEqual(DURATION.release)
    expect(DURATION.release).toBeLessThanOrEqual(DURATION.exit)
  })

  it('shrinks a card least and a glyph most', () => {
    expect(PRESS_SCALE_CARD).toBeGreaterThan(PRESS_SCALE)
    expect(PRESS_SCALE_GLYPH).toBeLessThan(PRESS_SCALE)
  })

  it('waits for a transition no longer than a block takes to arrive', () => {
    for (const ms of Object.values(DELAY)) expect(ms).toBeLessThan(DURATION.enter)
  })

  it('runs each loop cycle slower than a block arriving, so a loop reads as ambient', () => {
    for (const ms of Object.values(LOOP)) expect(ms).toBeGreaterThan(DURATION.enter)
  })
})
