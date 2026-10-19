import { PLAN_LIMITS } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { CHATS_LEFT_MAX_PIPS, chatsLeft } from './chatsLeft'

describe('chatsLeft', () => {
  it('reads both numbers off the quota, with the dots', () => {
    const free = PLAN_LIMITS.free.initiationsPer24h ?? 0
    expect(chatsLeft({ limit: free, remaining: 3 })).toEqual({ left: 3, total: free, pips: true })
  })

  it('draws no line without an allowance, or before it is known', () => {
    expect(chatsLeft(undefined)).toBeNull()
    // Pro: no limit, so no "of ∞".
    expect(chatsLeft({ limit: null, remaining: null })).toBeNull()
    expect(chatsLeft({ limit: 5, remaining: null })).toBeNull()
  })

  it('says none are left rather than going negative', () => {
    expect(chatsLeft({ limit: 5, remaining: 0 })).toEqual({ left: 0, total: 5, pips: true })
    expect(chatsLeft({ limit: 5, remaining: -2 })?.left).toBe(0)
  })

  it('never claims more left than the plan gives', () => {
    expect(chatsLeft({ limit: 5, remaining: 9 })?.left).toBe(5)
  })

  it('drops the dots when there would be too many to fit', () => {
    expect(chatsLeft({ limit: CHATS_LEFT_MAX_PIPS, remaining: 1 })?.pips).toBe(true)
    expect(chatsLeft({ limit: CHATS_LEFT_MAX_PIPS + 1, remaining: 1 })?.pips).toBe(false)
    expect(chatsLeft({ limit: 0, remaining: 0 })?.pips).toBe(false)
  })
})
