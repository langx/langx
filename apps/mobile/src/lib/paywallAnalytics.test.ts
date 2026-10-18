import { describe, expect, it } from 'vitest'
import { paywallExitKind, paywallOffersState, restoreResult } from './paywallAnalytics'

describe('paywallExitKind', () => {
  const routeKey = 'paywall-abc'

  it('calls it a close whenever our own button ran first, whatever the action was', () => {
    // The X reaches `router.back()`, which is a `GO_BACK` — the same action as
    // Android's back button, so the flag is the only thing that tells them apart.
    expect(paywallExitKind({ closed: true, action: { type: 'GO_BACK' }, routeKey })).toBe('close')
    expect(paywallExitKind({ closed: true, action: { type: 'REPLACE' }, routeKey })).toBe('close')
  })

  it('reads a GO_BACK nobody flagged as the back button', () => {
    expect(paywallExitKind({ closed: false, action: { type: 'GO_BACK' }, routeKey })).toBe('back')
  })

  it('reads the iOS swipe as a POP sourced from this route', () => {
    expect(
      paywallExitKind({ closed: false, action: { type: 'POP', source: routeKey }, routeKey }),
    ).toBe('gesture')
  })

  it('does not take a POP from some other route, or with no source, for the swipe', () => {
    expect(
      paywallExitKind({ closed: false, action: { type: 'POP', source: 'other-route' }, routeKey }),
    ).toBe('other')
    expect(paywallExitKind({ closed: false, action: { type: 'POP' }, routeKey })).toBe('other')
    expect(
      paywallExitKind({
        closed: false,
        action: { type: 'POP', source: routeKey },
        routeKey: undefined,
      }),
    ).toBe('other')
  })

  it('keeps a replace, a reset and a pop to top apart from the back button', () => {
    for (const type of ['REPLACE', 'RESET', 'POP_TO_TOP', 'NAVIGATE']) {
      expect(paywallExitKind({ closed: false, action: { type }, routeKey })).toBe('other')
    }
  })
})

describe('paywallOffersState', () => {
  const proYearly = { tier: 'pro', freeTrialDays: 7 }
  const proMonthly = { tier: 'pro', freeTrialDays: null }

  it('is owned over a plan already held, before the store is looked at', () => {
    expect(paywallOffersState({ owned: true, offers: null })).toBe('owned')
    expect(paywallOffersState({ owned: true, offers: [] })).toBe('owned')
  })

  it('is pending while the store has not answered', () => {
    expect(paywallOffersState({ owned: false, offers: null })).toBe('pending')
  })

  it('is none when the store answered with nothing to sell', () => {
    expect(paywallOffersState({ owned: false, offers: [] })).toBe('none')
  })

  it('is none when the only packages are for a tier the page does not show', () => {
    expect(
      paywallOffersState({ owned: false, offers: [{ tier: 'pro_plus', freeTrialDays: 7 }] }),
    ).toBe('none')
  })

  it('is trial when any Pro package carries a free week', () => {
    expect(paywallOffersState({ owned: false, offers: [proMonthly, proYearly] })).toBe('trial')
  })

  it('is plain when Pro is sold with no free week anywhere', () => {
    expect(paywallOffersState({ owned: false, offers: [proMonthly] })).toBe('plain')
  })
})

describe('restoreResult', () => {
  it('says the call completed, not that anything was restored', () => {
    expect(restoreResult(true)).toBe('completed')
  })

  it('says failed for a call that threw or had no store behind it', () => {
    expect(restoreResult(false)).toBe('failed')
  })
})
