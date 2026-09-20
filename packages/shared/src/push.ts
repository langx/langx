import { z } from 'zod'
import { localeSchema } from './locales'

export const PUSH_PLATFORMS = ['ios', 'android', 'web'] as const
export type PushPlatform = (typeof PUSH_PLATFORMS)[number]

export const registerDeviceSchema = z.object({
  /** Expo push token, e.g. `ExponentPushToken[xxx]`. */
  pushToken: z.string().trim().min(1),
  platform: z.enum(PUSH_PLATFORMS),
  /**
   * What language to word a notification for this device in.
   *
   * On the device rather than on the account, and optional, for the same
   * reason the app stores the preference on the device: a shared tablet and a
   * phone can be read by the same person in two languages, and an older client
   * that does not send it should keep getting English rather than failing to
   * register at all.
   */
  locale: localeSchema.optional(),
  /**
   * The installation's own id, stable across token rotations and sign-outs.
   *
   * **Optional, and it has to stay optional**: builds already on people's
   * phones send neither this nor `pushEnabled`, and they must keep working
   * exactly as they do. Its absence is what selects the old token-keyed path
   * in `registerDevice`.
   */
  deviceId: z.string().trim().min(1).max(128).optional(),
  /**
   * Whether this device wants notifications at all. Separate from the
   * account's per-kind settings, which say *what* rather than *where*; both
   * have to allow before anything is sent.
   */
  pushEnabled: z.boolean().optional(),
})
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>

/** `PATCH /me/devices/:deviceId` — the switch on the device itself. */
export const updateDeviceSchema = z.object({ pushEnabled: z.boolean() })
export type UpdateDeviceInput = z.infer<typeof updateDeviceSchema>

/**
 * `DELETE /me/devices?deviceId=…` — withdrawing this installation on sign-out.
 *
 * The installation alone, because that is all the server ever reads: given a
 * `deviceId`, `unregisterDevice` matches on it and never looks at the token.
 * The older `DELETE /me/devices/:token` therefore made the client mint an Expo
 * push token purely to fill a path segment — and on iOS minting one waits on
 * APNs registration and then on Expo's own server, neither of which has a
 * timeout. That wait sat in front of the sign-out itself. Nothing is looked up
 * here, so there is nothing to wait for.
 */
export const unregisterDeviceQuerySchema = z.object({
  deviceId: z.string().trim().min(1).max(128),
})
export type UnregisterDeviceQuery = z.infer<typeof unregisterDeviceQuerySchema>

export const PUSH_KINDS = [
  'message',
  'streakReminder',
  /** Cards due in Echo, at the end of the reader's day. */
  'echo',
  'badgeEarned',
  'profileVisits',
  'meetingReminder',
  'bountyPaid',
  /**
   * A new device, a changed password, a sign-in method connected or removed.
   * No preference gates it — see `modules/security/notify.ts` — so it is the
   * one kind with no row on the settings screen.
   */
  'security',
  /**
   * A payment that failed or a plan that ended. No preference gates it for
   * the same reason `security` has none: this is money, and the alternative
   * to hearing it is finding out when the plan stops.
   */
  'billing',
  /**
   * A nudge from `modules/notifications/promotions.ts` — add a photo, come
   * back, spend your tokens. The only kind here gated on `promotions`, which
   * is off until somebody turns it on.
   */
  'promotion',
  /** A follow, a correction or an answer on a post, a batch of likes. */
  'social',
  /** Yesterday's pool, or the hourly gift being ready again. */
  'wallet',
] as const
export type PushKind = (typeof PUSH_KINDS)[number]

/**
 * The notification category a message push carries, and the action on it.
 *
 * Both ends have to say the same word: the server puts `categoryId` on the
 * push, the app registers a category with this identifier, and the response
 * handler matches the action by its own. Three string literals in three files
 * is how a quick-reply button silently stops appearing, so they are one
 * constant each.
 *
 * Only messages get one. A correction or a follow has nothing to type back.
 */
export const PUSH_CATEGORY_MESSAGE = 'message'
export const PUSH_ACTION_REPLY = 'reply'

/**
 * Local hour (in the user's own timezone) at which the streak reminder is
 * worth sending: late enough that most people have had their chance to act,
 * early enough that they still can.
 */
export const STREAK_REMINDER_LOCAL_HOUR = 20

/**
 * And when the profile-visit round-up goes out.
 *
 * Eight hours from the streak nudge, so the two can never land in the same
 * evening — the fastest way to make somebody turn both off is to make the app
 * feel like it is pestering them. Lunchtime also happens to be when "people
 * looked at you" is something a person can act on.
 */
export const PROFILE_VISITS_LOCAL_HOUR = 12

/**
 * When the Echo nudge goes out.
 *
 * Seven, an hour before the streak reminder rather than beside it, and the
 * order is the point: the cards are the thing you can act on, and the streak
 * nudge an hour later is the one that says the day is nearly gone. Reversed,
 * the streak nudge would arrive first and the Echo one would read as a second
 * chase for the same thing.
 *
 * It shares the hour with the daily digest, which is mail. Different channel,
 * different medium, and the digest is a summary where this is an invitation
 * to do something now.
 */
export const ECHO_REMINDER_LOCAL_HOUR = 19

/** Monday, on the reader's own calendar. `Date.getUTCDay()` numbering. */
export const PROFILE_VISITS_WEEKLY_LOCAL_WEEKDAY = 1

/** How many visitors a weekly summary names, for the tier allowed to see them. */
export const PROFILE_VISITS_EMAIL_MAX_NAMES = 5

/**
 * When the round-up of badges earned since yesterday goes out.
 *
 * Evening, but two hours before the streak nudge rather than beside it: most
 * of what earns a badge — a streak day, a correction, the thousandth message —
 * happens during the day, and telling somebody at 18:00 what they achieved is
 * a better note to end on than telling them at breakfast about yesterday.
 */
export const BADGE_ROUND_UP_LOCAL_HOUR = 18
