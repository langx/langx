import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TIP_STATE,
  TIP_SLOTS,
  advanceSlot,
  dismissTip,
  parseTipState,
  pickTip,
  setTipsEnabled,
  shouldShowTip,
  type TipState,
} from './tips'

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

describe('rotation', () => {
  const enabled = (over: Partial<TipState> = {}): TipState => ({
    ...DEFAULT_TIP_STATE,
    ...over,
  })

  it('starts a slot at its first tip', () => {
    expect(pickTip(enabled(), 'chat')).toBe(TIP_SLOTS.chat[0])
  })

  /** The whole complaint: the same hint on every visit. */
  it('moves on each time, and comes back round', () => {
    let state = enabled()
    const shown: string[] = []
    for (let visit = 0; visit < TIP_SLOTS.chat.length + 1; visit++) {
      shown.push(pickTip(state, 'chat')!)
      state = advanceSlot(state, 'chat')
    }
    expect(shown.slice(0, TIP_SLOTS.chat.length)).toEqual([...TIP_SLOTS.chat])
    expect(shown.at(-1)).toBe(TIP_SLOTS.chat[0])
  })

  it('walks past one that was sent away', () => {
    const state = enabled({ dismissed: { [TIP_SLOTS.chat[0]]: true } })
    expect(pickTip(state, 'chat')).toBe(TIP_SLOTS.chat[1])
  })

  it('shows nothing once every tip in the slot is gone', () => {
    const dismissed = Object.fromEntries(TIP_SLOTS.feed.map((id) => [id, true]))
    expect(pickTip(enabled({ dismissed }), 'feed')).toBeNull()
  })

  it('shows nothing at all when tips are switched off', () => {
    expect(pickTip(enabled({ enabled: false }), 'chat')).toBeNull()
  })

  it('keeps each slot on its own cursor', () => {
    const state = advanceSlot(advanceSlot(enabled(), 'feed'), 'feed')
    expect(pickTip(state, 'feed')).toBe(TIP_SLOTS.feed[2])
    expect(pickTip(state, 'chat')).toBe(TIP_SLOTS.chat[0])
  })

  it('turning tips back on starts every slot over', () => {
    const used = setTipsEnabled(
      advanceSlot(dismissTip(DEFAULT_TIP_STATE, TIP_SLOTS.chat[0]), 'chat'),
      false,
    )
    const back = setTipsEnabled(used, true)
    expect(back.seen).toEqual({})
    expect(pickTip(back, 'chat')).toBe(TIP_SLOTS.chat[0])
  })
})

describe('parseTipState, cursors', () => {
  it('keeps a cursor that is a whole number in range', () => {
    expect(parseTipState({ enabled: true, seen: { chat: 2 } }).seen.chat).toBe(2)
  })

  /** A list that was reordered or shortened by a later build. */
  it('wraps a cursor that is past the end of its slot', () => {
    expect(parseTipState({ enabled: true, seen: { chat: 99 } }).seen.chat).toBe(
      99 % TIP_SLOTS.chat.length,
    )
  })

  it('drops anything that is not a whole non-negative number', () => {
    const seen = parseTipState({
      enabled: true,
      seen: { chat: -1, feed: 1.5, discover: 'two', chats: null },
    }).seen
    expect(seen).toEqual({})
  })

  it('drops a slot nobody has heard of', () => {
    expect(parseTipState({ enabled: true, seen: { nowhere: 3 } }).seen).toEqual({})
  })
})
