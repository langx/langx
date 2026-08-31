import { describe, expect, it } from 'vitest'
import { DEFAULT_TIP_STATE, dismissTip, parseTipState, setTipsEnabled, shouldShowTip } from './tips'

describe('parseTipState', () => {
  it('reads nothing, junk and an older shape as the default', () => {
    for (const raw of [null, undefined, 42, 'x', [], {}]) {
      expect(parseTipState(raw)).toEqual(DEFAULT_TIP_STATE)
    }
  })

  /** Tips default to shown, and a corrupt value must not turn a feature off. */
  it('treats anything but an explicit false as enabled', () => {
    expect(parseTipState({ enabled: 'yes' }).enabled).toBe(true)
    expect(parseTipState({ enabled: false }).enabled).toBe(false)
  })

  it('keeps only ids it knows', () => {
    const state = parseTipState({ dismissed: { chatCorrect: true, madeUp: true } })
    expect(state.dismissed).toEqual({ chatCorrect: true })
  })
})

describe('shouldShowTip', () => {
  it('hides a dismissed tip and shows the others', () => {
    const state = dismissTip(DEFAULT_TIP_STATE, 'chatCorrect')
    expect(shouldShowTip(state, 'chatCorrect')).toBe(false)
    expect(shouldShowTip(state, 'feedAsk')).toBe(true)
  })

  it('hides everything when tips are off', () => {
    const state = setTipsEnabled(DEFAULT_TIP_STATE, false)
    expect(shouldShowTip(state, 'feedAsk')).toBe(false)
  })
})

describe('setTipsEnabled', () => {
  /**
   * Otherwise the switch does nothing for the person most likely to reach for
   * it: someone who turned tips off after dismissing several would turn them
   * back on and see only the ones they never got to.
   */
  it('clears the dismissals when turning tips back on', () => {
    const off = setTipsEnabled(dismissTip(DEFAULT_TIP_STATE, 'chatCorrect'), false)
    const on = setTipsEnabled(off, true)
    expect(on).toEqual(DEFAULT_TIP_STATE)
  })

  it('keeps the dismissals when turning them off', () => {
    const state = setTipsEnabled(dismissTip(DEFAULT_TIP_STATE, 'feedAsk'), false)
    expect(state.dismissed).toEqual({ feedAsk: true })
  })
})
