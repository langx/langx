import { describe, expect, it } from 'vitest'
import {
  DEFAULT_NOTIFICATION_PREFS,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TYPES,
  notificationPrefsSchema,
  notificationsAllowed,
} from './notifications'

describe('notification defaults', () => {
  /**
   * Not a taste: consent to be marketed at has to be given rather than
   * withdrawn, so a new account is opted out of promotions on both channels.
   */
  it('opts nobody into promotions', () => {
    expect(DEFAULT_NOTIFICATION_PREFS.promotions).toEqual({ push: false, email: false })
  })

  it('leaves email off everywhere until there is something sending it', () => {
    for (const type of NOTIFICATION_TYPES) {
      expect(DEFAULT_NOTIFICATION_PREFS[type].email, type).toBe(false)
    }
  })

  it('keeps push on for what the app already does', () => {
    expect(DEFAULT_NOTIFICATION_PREFS.messages.push).toBe(true)
    expect(DEFAULT_NOTIFICATION_PREFS.streak.push).toBe(true)
  })
})

describe('notificationsAllowed', () => {
  it('honours an explicit choice', () => {
    expect(
      notificationsAllowed({ messages: { push: false, email: false } }, 'messages', 'push'),
    ).toBe(false)
    expect(
      notificationsAllowed({ promotions: { push: true, email: true } }, 'promotions', 'email'),
    ).toBe(true)
  })

  it('falls back to the default for anything unsaid', () => {
    expect(notificationsAllowed({}, 'messages', 'push')).toBe(true)
    expect(notificationsAllowed(undefined, 'streak', 'push')).toBe(true)
    expect(notificationsAllowed({ streak: {} }, 'streak', 'push')).toBe(true)
    expect(notificationsAllowed({}, 'promotions', 'push')).toBe(false)
  })

  /**
   * Profiles written before the matrix carry a single boolean. `false` was
   * "send me nothing" and has to keep meaning it — reading it as "unset" would
   * start pushing to everyone who had opted out.
   */
  it('still understands the single switch it replaces', () => {
    for (const type of NOTIFICATION_TYPES) {
      for (const channel of NOTIFICATION_CHANNELS) {
        expect(notificationsAllowed(false, type, channel), `${type}/${channel}`).toBe(false)
      }
    }
    expect(notificationsAllowed(true, 'messages', 'push')).toBe(true)
    expect(notificationsAllowed(true, 'promotions', 'push')).toBe(false)
  })
})

describe('notificationPrefsSchema', () => {
  it('accepts one key without demanding the other seven', () => {
    const result = notificationPrefsSchema.safeParse({ messages: { push: false } })
    expect(result.success).toBe(true)
  })

  it('refuses a type it does not know', () => {
    expect(notificationPrefsSchema.safeParse({ messages: { push: 'yes' } }).success).toBe(false)
  })
})
