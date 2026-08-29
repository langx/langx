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
})
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>

export const PUSH_KINDS = ['message', 'streakReminder'] as const
export type PushKind = (typeof PUSH_KINDS)[number]

/**
 * Local hour (in the user's own timezone) at which the streak reminder is
 * worth sending: late enough that most people have had their chance to act,
 * early enough that they still can.
 */
export const STREAK_REMINDER_LOCAL_HOUR = 20
