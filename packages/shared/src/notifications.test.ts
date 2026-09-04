import { describe, expect, it } from 'vitest'
import {
  DEFAULT_NOTIFICATION_PREFS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TYPES,
  notificationPrefsSchema,
  notificationsAllowed,
  notificationsUntouched,
  promotionsRefused,
  resolveNotificationPrefs,
  type StoredNotificationPrefs,
} from './notifications'

describe('notification defaults', () => {
  /**
   * Not a taste: consent to be marketed at has to be given rather than
   * withdrawn, so a new account is opted out of promotions — and out of both
   * channels, because an unsolicited email is the half with a regulator.
   */
  it('opts nobody into promotions, on either channel', () => {
    expect(DEFAULT_NOTIFICATION_PREFS.promotions).toEqual({ push: false, email: false })
  })

  it('is on for what the app already does', () => {
    expect(DEFAULT_NOTIFICATION_PREFS.messages).toEqual({ push: true, email: true })
    expect(DEFAULT_NOTIFICATION_PREFS.streak).toEqual({ push: true, email: true })
  })

  it('covers every kind on every channel, so no cell falls through to undefined', () => {
    for (const type of NOTIFICATION_TYPES) {
      for (const channel of NOTIFICATION_CHANNELS) {
        expect(typeof DEFAULT_NOTIFICATION_PREFS[type][channel], `${type}.${channel}`).toBe(
          'boolean',
        )
      }
    }
  })
})

describe('notificationsAllowed', () => {
  it('honours an explicit choice', () => {
    expect(notificationsAllowed({ messages: { push: false } }, 'messages', 'push')).toBe(false)
    expect(notificationsAllowed({ promotions: { email: true } }, 'promotions', 'email')).toBe(true)
  })

  it('falls back to the default for anything unsaid', () => {
    expect(notificationsAllowed({}, 'messages', 'push')).toBe(true)
    expect(notificationsAllowed(undefined, 'streak', 'email')).toBe(true)
    expect(notificationsAllowed({}, 'promotions', 'push')).toBe(false)
    expect(notificationsAllowed({}, 'promotions', 'email')).toBe(false)
  })

  /**
   * The oldest shape: one boolean for everything. `false` was "send me
   * nothing" and has to keep meaning it — reading it as "unset" would start
   * pushing to everyone who had opted out.
   */
  it('still understands the single switch v1 wrote', () => {
    for (const type of NOTIFICATION_TYPES) {
      for (const channel of NOTIFICATION_CHANNELS) {
        expect(notificationsAllowed(false, type, channel), `${type}.${channel}`).toBe(false)
      }
    }
    expect(notificationsAllowed(true, 'messages', 'push')).toBe(true)
    expect(notificationsAllowed(true, 'messages', 'email')).toBe(true)
    expect(notificationsAllowed(true, 'promotions', 'push')).toBe(false)
    expect(notificationsAllowed(true, 'promotions', 'email')).toBe(false)
  })

  describe('the bare boolean per kind, written while there was no channel axis', () => {
    /** Push was the only channel with a sender, so the switch was a push switch. */
    it('reads push literally', () => {
      expect(notificationsAllowed({ messages: false }, 'messages', 'push')).toBe(false)
      expect(notificationsAllowed({ promotions: true }, 'promotions', 'push')).toBe(true)
    })

    it('silences both channels when it is off', () => {
      expect(notificationsAllowed({ streak: false }, 'streak', 'email')).toBe(false)
    })

    /**
     * Nobody was shown an email option while this shape was being written, so
     * a `true` consented to nothing about mail. For the service kinds that
     * lands on the default; for promotions it must not.
     */
    it('never lets it consent to email that was never offered', () => {
      expect(notificationsAllowed({ messages: true }, 'messages', 'email')).toBe(true)
      expect(notificationsAllowed({ promotions: true }, 'promotions', 'email')).toBe(false)
    })
  })

  describe('the {push, email} object', () => {
    it('reads both halves literally, now that both have a sender', () => {
      expect(
        notificationsAllowed({ messages: { push: false, email: true } }, 'messages', 'push'),
      ).toBe(false)
      expect(
        notificationsAllowed({ messages: { push: false, email: true } }, 'messages', 'email'),
      ).toBe(true)
    })

    it('fills a half nobody named with the default', () => {
      expect(notificationsAllowed({ messages: { email: false } }, 'messages', 'push')).toBe(true)
      expect(notificationsAllowed({ streak: { push: false } }, 'streak', 'email')).toBe(true)
      expect(notificationsAllowed({ promotions: { push: true } }, 'promotions', 'email')).toBe(
        false,
      )
    })

    it('falls back to the default for an empty object', () => {
      expect(notificationsAllowed({ streak: {} }, 'streak', 'push')).toBe(true)
      expect(notificationsAllowed({ promotions: {} }, 'promotions', 'email')).toBe(false)
    })
  })
})

describe('resolveNotificationPrefs', () => {
  it('answers for every cell, whatever shape was stored', () => {
    for (const stored of [
      undefined,
      true,
      false,
      { messages: false },
      { streak: { push: false } },
    ]) {
      const resolved = resolveNotificationPrefs(stored)
      for (const type of NOTIFICATION_TYPES) {
        for (const channel of NOTIFICATION_CHANNELS) {
          expect(typeof resolved[type][channel], `${type}.${channel}`).toBe('boolean')
        }
      }
    }
  })

  it('agrees with the reader it is built on', () => {
    const stored = { messages: { push: false }, promotions: true }
    const resolved = resolveNotificationPrefs(stored)
    expect(resolved.messages).toEqual({ push: false, email: true })
    expect(resolved.promotions).toEqual({ push: true, email: false })
  })
})

describe('notificationPrefsSchema', () => {
  it('accepts one cell without demanding the other seven', () => {
    expect(notificationPrefsSchema.safeParse({ messages: { email: false } }).success).toBe(true)
  })

  it('refuses a value that is not a boolean', () => {
    expect(notificationPrefsSchema.safeParse({ messages: { email: 'yes' } }).success).toBe(false)
  })

  /**
   * A client may no longer send the bare boolean. It is still *read* — old
   * accounts carry it — but a screen that can draw two switches has no excuse
   * for writing a value that cannot say which one moved.
   */
  it('refuses the channel-less shape it replaces', () => {
    expect(notificationPrefsSchema.safeParse({ messages: false }).success).toBe(false)
  })
})

describe('promotionsRefused', () => {
  /**
   * The distinction `notificationsAllowed` deliberately does not make. Both
   * of these are "do not send" to a sender; only one of them is a decision.
   */
  it('separates a refusal from a question nobody answered', () => {
    expect(promotionsRefused({ promotions: { email: false } }, 'email')).toBe(true)
    expect(promotionsRefused({}, 'email')).toBe(false)
    expect(promotionsRefused(undefined, 'email')).toBe(false)
  })

  it("reads v1's single switch as a refusal only when it was turned off", () => {
    expect(promotionsRefused(false, 'email')).toBe(true)
    expect(promotionsRefused(true, 'email')).toBe(false)
  })

  it('does not read a yes on one channel as a no on the other', () => {
    expect(promotionsRefused({ promotions: { push: false, email: true } }, 'email')).toBe(false)
    expect(promotionsRefused({ promotions: { push: false, email: true } }, 'push')).toBe(true)
  })

  it('keeps every path in step with the sender that must not send', () => {
    const shapes: (StoredNotificationPrefs | boolean | undefined)[] = [
      undefined,
      true,
      false,
      {},
      { promotions: true },
      { promotions: false },
    ]
    for (const prefs of shapes) {
      if (promotionsRefused(prefs, 'email')) {
        expect(notificationsAllowed(prefs, 'promotions', 'email')).toBe(false)
      }
    }
  })
})

describe('notificationsUntouched', () => {
  /**
   * `createProfile` stores this object whole, so it is what almost every
   * account carries — and it is not an answer to anything.
   */
  it('recognises the defaults it is given at sign-up', () => {
    expect(notificationsUntouched(DEFAULT_NOTIFICATION_PREFS)).toBe(true)
    expect(notificationsUntouched(undefined)).toBe(true)
    expect(notificationsUntouched({})).toBe(true)
  })

  it('counts one moved switch anywhere as having been answered', () => {
    expect(
      notificationsUntouched({
        ...DEFAULT_NOTIFICATION_PREFS,
        badges: { push: false, email: false },
      }),
    ).toBe(false)
    expect(notificationsUntouched({ promotions: { email: false } })).toBe(false)
  })

  /**
   * The shape almost every production account written before 3 September
   * carries. It came out of a `createProfile` that stored the default of the
   * day, so it is nobody's answer either.
   */
  it('recognises the defaults of the two shapes it replaced', () => {
    expect(
      notificationsUntouched({
        messages: true,
        streak: true,
        profileVisits: true,
        promotions: false,
      }),
    ).toBe(true)
    expect(
      notificationsUntouched({
        messages: { push: true, email: false },
        streak: { push: true, email: false },
        profileVisits: { push: true, email: false },
        promotions: { push: false, email: false },
      }),
    ).toBe(true)
  })

  it('stops recognising one the moment a row differs from it', () => {
    expect(
      notificationsUntouched({
        messages: false,
        streak: true,
        profileVisits: true,
        promotions: false,
      }),
    ).toBe(false)
  })

  it("takes v1's silence as a decision and its default as none", () => {
    expect(notificationsUntouched(false)).toBe(false)
    expect(notificationsUntouched(true)).toBe(true)
  })
})
