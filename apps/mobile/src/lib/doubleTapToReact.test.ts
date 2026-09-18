import { describe, expect, it } from 'vitest'
import { createDoubleTap, doubleTapToReactEnabled, DOUBLE_TAP_MS } from './doubleTapToReact'

describe('double tap to react', () => {
  it('fires on the second tap inside the window', () => {
    const tap = createDoubleTap()
    expect(tap(1000)).toBe(false)
    expect(tap(1000 + DOUBLE_TAP_MS - 1)).toBe(true)
  })

  it('does not fire when the second tap is too late', () => {
    const tap = createDoubleTap()
    expect(tap(1000)).toBe(false)
    expect(tap(1000 + DOUBLE_TAP_MS + 1)).toBe(false)
  })

  /**
   * A late second tap has to start a new pair rather than be discarded, or a
   * slow tapper could never reach the gesture at all — every other tap would
   * be spent resetting.
   */
  it('treats a late tap as the first of the next pair', () => {
    const tap = createDoubleTap()
    tap(1000)
    expect(tap(5000)).toBe(false)
    expect(tap(5100)).toBe(true)
  })

  /**
   * Three taps are one double and one single. Left unconsumed, the third tap
   * would pair with the second and send the heart twice — and since the server
   * toggles, the second send takes it straight back off. The gesture would
   * look broken rather than repeated.
   */
  it('consumes the pair, so a triple tap reacts once', () => {
    const tap = createDoubleTap()
    expect([tap(0), tap(100), tap(200)]).toEqual([false, true, false])
  })

  it('reacts again on a fourth tap', () => {
    const tap = createDoubleTap()
    expect([tap(0), tap(100), tap(200), tap(300)]).toEqual([false, true, false, true])
  })

  /**
   * The same rule as the swipe, and for the neighbouring reason: on a desktop
   * a double-click is the browser selecting a word.
   */
  it('is offered wherever there is a finger, and not to a mouse', () => {
    expect(doubleTapToReactEnabled('ios', true)).toBe(true)
    expect(doubleTapToReactEnabled('android', true)).toBe(true)
    expect(doubleTapToReactEnabled('web', true)).toBe(true)
    expect(doubleTapToReactEnabled('web', false)).toBe(false)
  })
})
