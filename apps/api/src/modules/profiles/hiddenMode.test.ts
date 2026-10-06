import { describe, expect, it } from 'vitest'
import { effectiveHiddenMode, hiddenModePaths } from './hiddenMode'
import type { Profile } from './profiles'

type Subject = Pick<Profile, 'settings' | 'privacy' | 'entitlement'>

function profile(
  overrides: {
    discoverable?: boolean
    privacy?: Partial<Profile['privacy']>
    tier?: 'free' | 'pro'
  } = {},
): Subject {
  return {
    settings: { discoverable: overrides.discoverable ?? true, notifications: false },
    privacy: { incognito: false, ...overrides.privacy },
    entitlement: { tier: overrides.tier ?? 'free', updatedAt: new Date() },
  }
}

/** The profile as it would read after the paths were written. */
function apply(subject: Subject, paths: Record<string, unknown>): Subject {
  const next = structuredClone(subject)
  for (const [path, value] of Object.entries(paths)) {
    const [head, key] = path.split('.') as ['settings' | 'privacy', string]
    ;(next[head] as Record<string, unknown>)[key] = value
  }
  return next
}

describe('effectiveHiddenMode', () => {
  it('reads a stored switch as stored', () => {
    expect(effectiveHiddenMode(profile({ privacy: { hiddenMode: true } }))).toBe(true)
    expect(
      effectiveHiddenMode(profile({ discoverable: false, privacy: { hiddenMode: false } })),
    ).toBe(false)
  })

  /**
   * The failure this feature must not have: somebody who hid themselves before
   * the switch existed reads as on, so nothing they chose is greyed out and
   * switched back.
   */
  it('works it out as on for anybody already hiding something', () => {
    expect(effectiveHiddenMode(profile({ discoverable: false }))).toBe(true)
    expect(effectiveHiddenMode(profile({ privacy: { hideOnlineStatus: true } }))).toBe(true)
    expect(effectiveHiddenMode(profile({ privacy: { refuseNewChats: true } }))).toBe(true)
    expect(effectiveHiddenMode(profile({ privacy: { incognito: true }, tier: 'pro' }))).toBe(true)
  })

  it('works it out as off for somebody hiding nothing', () => {
    expect(effectiveHiddenMode(profile())).toBe(false)
  })

  it('does not count a lapsed subscription’s leftover incognito', () => {
    expect(effectiveHiddenMode(profile({ privacy: { incognito: true }, tier: 'free' }))).toBe(false)
  })
})

describe('hiddenModePaths', () => {
  it('turned off: keeps the choices and puts all four back to visible', () => {
    const current = profile({
      discoverable: false,
      privacy: { hiddenMode: true, hideOnlineStatus: true, refuseNewChats: false, incognito: true },
      tier: 'pro',
    })
    expect(hiddenModePaths(current, { privacy: { hiddenMode: false } })).toEqual({
      'privacy.hiddenMode': false,
      'privacy.hiddenModeChoices': {
        hideFromDiscover: true,
        hideOnlineStatus: true,
        refuseNewChats: false,
        incognito: true,
      },
      'settings.discoverable': true,
      'privacy.hideOnlineStatus': false,
      'privacy.refuseNewChats': false,
      'privacy.incognito': false,
    })
  })

  it('turned back on: restores exactly what was kept', () => {
    const before = profile({
      discoverable: false,
      privacy: { hiddenMode: true, hideOnlineStatus: false, refuseNewChats: true },
    })
    const off = apply(before, hiddenModePaths(before, { privacy: { hiddenMode: false } }))
    const on = apply(off, hiddenModePaths(off, { privacy: { hiddenMode: true } }))
    expect(on.settings.discoverable).toBe(false)
    expect(on.privacy).toMatchObject({
      hiddenMode: true,
      hideOnlineStatus: false,
      refuseNewChats: true,
      incognito: false,
    })
  })

  /**
   * A retried "off" — the app resending after a dropped answer — must not
   * replace the kept choices with the all-visible values now in force.
   */
  it('does not overwrite the kept choices when turned off twice', () => {
    const before = profile({ discoverable: false, privacy: { hiddenMode: true } })
    const off = apply(before, hiddenModePaths(before, { privacy: { hiddenMode: false } }))
    expect(hiddenModePaths(off, { privacy: { hiddenMode: false } })).toEqual({
      'privacy.hiddenMode': false,
    })
  })

  it('turned on for the first time: all four, incognito only on a plan that has it', () => {
    expect(hiddenModePaths(profile({ tier: 'pro' }), { privacy: { hiddenMode: true } })).toEqual({
      'privacy.hiddenMode': true,
      'settings.discoverable': false,
      'privacy.hideOnlineStatus': true,
      'privacy.refuseNewChats': true,
      'privacy.incognito': true,
    })
    expect(hiddenModePaths(profile(), { privacy: { hiddenMode: true } })).toMatchObject({
      'privacy.incognito': false,
    })
  })

  it('turned on over kept choices that hide nothing: all four, not nothing', () => {
    const current = profile({
      privacy: {
        hiddenMode: false,
        hiddenModeChoices: {
          hideFromDiscover: false,
          hideOnlineStatus: false,
          refuseNewChats: false,
          incognito: false,
        },
      },
    })
    expect(hiddenModePaths(current, { privacy: { hiddenMode: true } })).toMatchObject({
      'settings.discoverable': false,
      'privacy.hideOnlineStatus': true,
      'privacy.refuseNewChats': true,
    })
  })

  it('with the switch on, lets one of the four change without touching the switch', () => {
    const current = profile({
      discoverable: false,
      privacy: { hiddenMode: true, hideOnlineStatus: true },
    })
    expect(hiddenModePaths(current, { privacy: { hideOnlineStatus: false } })).toEqual({})
    expect(hiddenModePaths(current, { discoverable: true })).toEqual({})
  })

  /**
   * Somebody whose switch is only worked out — they hid one thing before it
   * existed — turns that one thing off. The switch they see as on must stay
   * on, not go off by itself because nothing is hidden any more.
   */
  it('pins a worked-out switch the first time one of the four changes', () => {
    const current = profile({ privacy: { hideOnlineStatus: true } })
    expect(hiddenModePaths(current, { privacy: { hideOnlineStatus: false } })).toEqual({
      'privacy.hiddenMode': true,
    })
  })

  /** A client from before the switch writes a child directly while it is off. */
  it('turns the switch on when an old client hides something while it is off', () => {
    const off = profile({ privacy: { hiddenMode: false } })
    expect(hiddenModePaths(off, { discoverable: false })).toEqual({ 'privacy.hiddenMode': true })
    expect(hiddenModePaths(off, { privacy: { hideOnlineStatus: true } })).toEqual({
      'privacy.hiddenMode': true,
    })
    expect(hiddenModePaths(off, { privacy: { activityMapVisible: false } })).toEqual({})
  })

  it('ignores a free account’s incognito when deciding an old client hid something', () => {
    const off = profile({ privacy: { hiddenMode: false } })
    expect(hiddenModePaths(off, { privacy: { incognito: true } })).toEqual({})
  })
})
