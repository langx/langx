import { z } from 'zod'

/**
 * What the app may send.
 *
 * One boolean used to cover all of it — `settings.notifications` — which meant
 * that somebody who did not want a nudge about their streak had to turn off
 * the message they were waiting for as well. Four kinds fixed that, and each
 * kind briefly had two channels behind it, push and email.
 *
 * The email column never sent anything. `apps/api/src/email/` has exactly two
 * templates, verification and password reset, and `EmailSender` is imported by
 * no module; six of the eight switches did nothing at all. A settings screen
 * that offers a choice which changes nothing is worse than one that does not
 * offer it, so the channel axis is gone and each kind is one switch again.
 *
 * The kind axis stays, because that one was never the problem.
 */
export const NOTIFICATION_TYPES = ['messages', 'streak', 'profileVisits', 'promotions'] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export type NotificationPrefs = Record<NotificationType, boolean>

/**
 * What is actually on a profile, and it is three shapes at once.
 *
 * A `boolean` is a v1 account, one switch for everything. A `{push, email}`
 * object is an account written while the matrix existed. A bare boolean per
 * kind is what this version writes. All three are live in production
 * simultaneously, which is why `notificationsAllowed` is the only thing
 * allowed to read this field.
 */
export type StoredNotificationPrefs = Partial<
  Record<NotificationType, boolean | { push?: boolean; email?: boolean }>
>

/**
 * On for everything the app already does; **promotions off**.
 *
 * The last one is not a taste. Consent to be marketed at has to be given, not
 * withdrawn — GDPR calls a pre-ticked box no consent at all, and CAN-SPAM's
 * unsubscribe is the floor rather than the rule. So a new account is opted out
 * of promotions and opted in to the things it asked for by installing the app.
 */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  messages: true,
  streak: true,
  profileVisits: true,
  promotions: false,
}

/**
 * Partial, like `privacy` in `updateProfileSchema` and for the same reason: a
 * client sending `{ messages: false }` must not have to restate the other
 * three, and must not blank them by omission. The repository writes dotted
 * paths, so an absent key stays as it was.
 */
export const notificationPrefsSchema = z
  .object({
    messages: z.boolean(),
    streak: z.boolean(),
    profileVisits: z.boolean(),
    promotions: z.boolean(),
  })
  .partial()
export type NotificationPrefsInput = z.infer<typeof notificationPrefsSchema>

/**
 * Whether one notification may be sent.
 *
 * Missing means default: profiles written before this existed carry a boolean,
 * a matrix, or nothing at all, and none of those should be read as "wants
 * nothing". The one thing that is never inferred is a promotion — absent stays
 * off, because consent is the thing that has to be recorded.
 */
export function notificationsAllowed(
  prefs: StoredNotificationPrefs | boolean | undefined,
  type: NotificationType,
): boolean {
  // The oldest shape: one switch for everything. `false` meant silence, and it
  // still does; `true` means the defaults.
  if (typeof prefs === 'boolean') {
    return prefs ? DEFAULT_NOTIFICATION_PREFS[type] : false
  }

  const chosen = prefs?.[type]
  if (typeof chosen === 'boolean') return chosen

  /*
   * The matrix shape, collapsed to its `push` half.
   *
   * `push` is the only channel that ever sent anything, so it is the only one
   * that recorded a real decision — `email` was a preference filed against a
   * sender that did not exist. Reading `push || email` would silently switch
   * push back on for somebody who turned it off and left the dead email box
   * ticked, which is the one migration mistake here that a user would notice.
   */
  if (chosen && typeof chosen === 'object') {
    return chosen.push ?? DEFAULT_NOTIFICATION_PREFS[type]
  }

  return DEFAULT_NOTIFICATION_PREFS[type]
}
