import { z } from 'zod'
import { localeSchema } from './locales'

export const PUSH_PLATFORMS = ['ios', 'android', 'web'] as const
export type PushPlatform = (typeof PUSH_PLATFORMS)[number]

export const registerDeviceSchema = z.object({
  /** The device's FCM registration token, on both platforms. */
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
})
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>

export const PUSH_KINDS = ['message', 'streakReminder', 'badgeEarned', 'profileVisits'] as const
export type PushKind = (typeof PUSH_KINDS)[number]

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
