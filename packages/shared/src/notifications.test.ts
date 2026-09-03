import { describe, expect, it } from 'vitest'
import {
  DEFAULT_NOTIFICATION_PREFS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TYPES,
  notificationPrefsSchema,
  notificationsAllowed,
  resolveNotificationPrefs,
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
