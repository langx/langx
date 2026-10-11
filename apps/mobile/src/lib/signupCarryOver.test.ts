import { describe, expect, it, vi } from 'vitest'

const cleared: string[] = []
vi.mock('./localFlags', () => ({
  FLAG_KEYS: { pendingReferrer: 'pendingReferrer', pendingIntent: 'pendingIntent' },
  clearFlag: vi.fn((key: string) => {
    cleared.push(key)
    return Promise.resolve()
  }),
}))

const { clearSignupCarryOver, signupCarryOverIsStale } = await import('./signupCarryOver')

describe('signupCarryOverIsStale', () => {
  it('is stale once a real account is known to have a profile', () => {
    expect(signupCarryOverIsStale({ state: 'ready', isGuest: false })).toBe(true)
  })

  it('is kept for an account still in onboarding, which is about to read it', () => {
    expect(signupCarryOverIsStale({ state: 'onboarding', isGuest: false })).toBe(false)
  })

  it('is kept when the profile request failed, which says nothing either way', () => {
    expect(signupCarryOverIsStale({ state: 'failed', isGuest: false })).toBe(false)
  })

  it('is kept for a guest, who has a profile but has not signed up yet', () => {
    expect(signupCarryOverIsStale({ state: 'ready', isGuest: true })).toBe(false)
  })
})

describe('clearSignupCarryOver', () => {
  it('drops both the referrer and the intent', async () => {
    await clearSignupCarryOver()
    expect(cleared.sort()).toEqual(['pendingIntent', 'pendingReferrer'])
  })
})
