import { describe, expect, it } from 'vitest'
import {
  DEFAULT_NOTIFICATION_PREFS,
  NOTIFICATION_TYPES,
  notificationPrefsSchema,
  notificationsAllowed,
} from './notifications'

describe('notification defaults', () => {
  /**
   * Not a taste: consent to be marketed at has to be given rather than
   * withdrawn, so a new account is opted out of promotions.
   */
  it('opts nobody into promotions', () => {
    expect(DEFAULT_NOTIFICATION_PREFS.promotions).toBe(false)
  })

  it('is on for what the app already does', () => {
    expect(DEFAULT_NOTIFICATION_PREFS.messages).toBe(true)
    expect(DEFAULT_NOTIFICATION_PREFS.streak).toBe(true)
  })

  it('covers every type, so no kind falls through to undefined', () => {
    for (const type of NOTIFICATION_TYPES) {
      expect(typeof DEFAULT_NOTIFICATION_PREFS[type], type).toBe('boolean')
    }
  })
})

describe('notificationsAllowed', () => {
  it('honours an explicit choice', () => {
    expect(notificationsAllowed({ messages: false }, 'messages')).toBe(false)
    expect(notificationsAllowed({ promotions: true }, 'promotions')).toBe(true)
  })

  it('falls back to the default for anything unsaid', () => {
    expect(notificationsAllowed({}, 'messages')).toBe(true)
    expect(notificationsAllowed(undefined, 'streak')).toBe(true)
    expect(notificationsAllowed({}, 'promotions')).toBe(false)
  })

  /**
   * The oldest shape: one boolean for everything. `false` was "send me
   * nothing" and has to keep meaning it — reading it as "unset" would start
   * pushing to everyone who had opted out.
   */
  it('still understands the single switch v1 wrote', () => {
    for (const type of NOTIFICATION_TYPES) {
      expect(notificationsAllowed(false, type), type).toBe(false)
    }
    expect(notificationsAllowed(true, 'messages')).toBe(true)
    expect(notificationsAllowed(true, 'promotions')).toBe(false)
  })

  describe('the push/email matrix it replaces', () => {
    it('reads the push half, because email never sent anything', () => {
      expect(notificationsAllowed({ messages: { push: false, email: false } }, 'messages')).toBe(
        false,
      )
      expect(notificationsAllowed({ streak: { push: true, email: false } }, 'streak')).toBe(true)
    })

    /**
     * The one migration mistake a user would notice. Somebody who turned push
     * off and left the dead email box ticked opted *out*; `push || email`
     * would switch them back on.
     */
    it('does not let a ticked email box switch push back on', () => {
      expect(notificationsAllowed({ messages: { push: false, email: true } }, 'messages')).toBe(
        false,
      )
      expect(notificationsAllowed({ promotions: { push: false, email: true } }, 'promotions')).toBe(
        false,
      )
    })

    it('falls back to the default when the matrix named only email', () => {
      expect(notificationsAllowed({ messages: { email: true } }, 'messages')).toBe(true)
      expect(notificationsAllowed({ promotions: { email: true } }, 'promotions')).toBe(false)
    })

    it('falls back to the default for an empty object', () => {
      expect(notificationsAllowed({ streak: {} }, 'streak')).toBe(true)
      expect(notificationsAllowed({ promotions: {} }, 'promotions')).toBe(false)
    })
  })
})

describe('notificationPrefsSchema', () => {
  it('accepts one key without demanding the other three', () => {
    expect(notificationPrefsSchema.safeParse({ messages: false }).success).toBe(true)
  })

  it('refuses a value that is not a boolean', () => {
    expect(notificationPrefsSchema.safeParse({ messages: 'yes' }).success).toBe(false)
  })

  /** The matrix is no longer a thing a client may send. */
  it('refuses the shape it replaces', () => {
    expect(notificationPrefsSchema.safeParse({ messages: { push: false } }).success).toBe(false)
  })
})
