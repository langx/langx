import { z } from 'zod'

export const PUSH_PLATFORMS = ['ios', 'android', 'web'] as const
export type PushPlatform = (typeof PUSH_PLATFORMS)[number]

export const registerDeviceSchema = z.object({
  /** Expo push token, e.g. `ExponentPushToken[xxx]`. */
  pushToken: z.string().trim().min(1),
  platform: z.enum(PUSH_PLATFORMS),
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
