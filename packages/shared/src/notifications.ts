import { z } from 'zod'

/**
 * What the app may send, and how.
 *
 * One boolean used to cover all of it — `settings.notifications` — which meant
 * that somebody who did not want a nudge about their streak had to turn off
 * the message they were waiting for as well. Four kinds, two channels, and the
 * settings screen is the matrix.
 */
export const NOTIFICATION_TYPES = ['messages', 'streak', 'profileVisits', 'promotions'] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const NOTIFICATION_CHANNELS = ['push', 'email'] as const
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number]

export type NotificationPrefs = Record<NotificationType, Record<NotificationChannel, boolean>>

/**
 * Push on for everything the app already does; email off; **promotions off on
 * both**.
 *
 * The last one is not a taste. Consent to be marketed at has to be given, not
 * withdrawn — GDPR calls a pre-ticked box no consent at all, and CAN-SPAM's
 * unsubscribe is the floor rather than the rule. So a new account is opted out
 * of promotions and opted in to the things it asked for by installing the app.
 */
export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  messages: { push: true, email: false },
  streak: { push: true, email: false },
  profileVisits: { push: true, email: false },
  promotions: { push: false, email: false },
}

const channelsSchema = z.object({ push: z.boolean(), email: z.boolean() }).partial()

/**
 * Partial at both levels, like `privacy` in `updateProfileSchema` and for the
 * same reason: a client sending `{ messages: { push: false } }` must not have
 * to restate the other seven booleans, and must not blank them by omission.
 * The repository writes dotted paths, so an absent key stays as it was.
 */
export const notificationPrefsSchema = z
  .object({
    messages: channelsSchema,
    streak: channelsSchema,
    profileVisits: channelsSchema,
    promotions: channelsSchema,
  })
  .partial()
export type NotificationPrefsInput = z.infer<typeof notificationPrefsSchema>

/**
 * Whether one notification may be sent.
 *
 * Missing means default, at both levels: profiles written before this existed
 * carry a boolean or nothing at all, and neither should be read as "wants
 * nothing". The one thing that is never inferred is a promotion — absent stays
 * off, because consent is the thing that has to be recorded.
 */
export function notificationsAllowed(
  prefs: Partial<NotificationPrefs> | boolean | undefined,
  type: NotificationType,
  channel: NotificationChannel,
): boolean {
  // The old shape: one switch for everything. `false` meant silence, and it
  // still does; `true` means the defaults.
  if (typeof prefs === 'boolean') {
    return prefs ? DEFAULT_NOTIFICATION_PREFS[type][channel] : false
  }
  const chosen = prefs?.[type]?.[channel]
  return chosen ?? DEFAULT_NOTIFICATION_PREFS[type][channel]
}
