import { localTimeOn, shiftDayKey, SOCIAL_PLATFORMS, type SocialPlatform } from '@langx/shared'
import { z } from 'zod'
import type { SocialPostAlternate, SocialPostSlot } from './posts'

/**
 * The calendar file the operator approves, as it is written — `calendar.json`
 * from the Venus production folder. Read as is: keys this does not name
 * (`kind`, `cta`, `line`, `duration`, a slot's own `status`) are for the
 * person reviewing it and are dropped, and every row is imported as a draft
 * whatever the file says, because approving is its own step.
 *
 * File names are taken from the calendar and never built: a day can be
 * re-cut under a new name (`-r2`), and a URL put together from the day and
 * the language would quietly post the old cut.
 */

const textPostSchema = z.object({
  caption: z.string().min(1),
  hashtags: z.array(z.string()).default([]),
})

/** YouTube refuses a title over a hundred characters, so the file is refused first. */
const youtubePostSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string(),
  tags: z.array(z.string()).default([]),
})

const postSchema = z.object({
  lang: z.string().min(2),
  videoUrl: z.url({ protocol: /^https$/ }),
  coverUrl: z.url({ protocol: /^https$/ }),
  /** `HH:MM` on the calendar's clock. */
  postTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  platforms: z.object({
    instagram: textPostSchema,
    tiktok: textPostSchema,
    youtube: youtubePostSchema,
  }),
  firstComment: z.string().min(1).nullable().optional(),
})

const slotSchema = postSchema.extend({
  dayOffset: z.number().int().min(0),
  videoDay: z.number().int().min(1),
  nativeCheck: z.string().min(1).nullable().optional(),
  enAlternate: postSchema.nullable().optional(),
})

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/

export const socialCalendarSchema = z.object({
  version: z.number().int().positive(),
  timezone: z.string().refine(isTimeZone, 'Not a time zone this runtime knows'),
  startDate: z.string().regex(DAY_KEY).nullable(),
  slots: z
    .array(slotSchema)
    .min(1)
    .refine(
      (slots) => new Set(slots.map((slot) => slot.dayOffset)).size === slots.length,
      'Two slots share a dayOffset',
    ),
})
export type SocialCalendar = z.infer<typeof socialCalendarSchema>
type CalendarPost = z.infer<typeof postSchema>

function isTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone })
    return true
  } catch {
    return false
  }
}

/** `postTime` on `dayKey`, on the zone's clock, as an instant. */
function atLocal(dayKey: string, postTime: string, timeZone: string): Date {
  const [hour = 0, minute = 0] = postTime.split(':').map(Number)
  return new Date(localTimeOn(dayKey, hour, timeZone).getTime() + minute * 60 * 1000)
}

/**
 * One platform's words. Facebook takes Instagram's: the calendar writes for
 * three platforms, and a Page reel is the same audience's other door.
 */
function contentFor(post: CalendarPost, platform: SocialPlatform) {
  if (platform === 'youtube') return { ...post.platforms.youtube }
  if (platform === 'tiktok') return { ...post.platforms.tiktok }
  return { ...post.platforms.instagram }
}

/**
 * Every row a calendar makes for `platforms`, starting on `startDate`.
 *
 * The first comment is kept on the Instagram row only: Instagram is the one
 * platform where this app is given the permission to leave one.
 */
export function calendarSlots(
  calendar: SocialCalendar,
  startDate: string,
  platforms: readonly SocialPlatform[] = SOCIAL_PLATFORMS,
): SocialPostSlot[] {
  if (!DAY_KEY.test(startDate)) throw new TypeError(`Not a YYYY-MM-DD date: ${startDate}`)
  const slots: SocialPostSlot[] = []
  for (const slot of calendar.slots) {
    const day = shiftDayKey(startDate, slot.dayOffset)
    for (const platform of platforms) {
      const comment = (post: CalendarPost) =>
        platform === 'instagram' ? (post.firstComment ?? null) : null
      const alternate: SocialPostAlternate | null = slot.enAlternate
        ? {
            lang: slot.enAlternate.lang,
            videoUrl: slot.enAlternate.videoUrl,
            coverUrl: slot.enAlternate.coverUrl,
            scheduledAt: atLocal(day, slot.enAlternate.postTime, calendar.timezone),
            content: contentFor(slot.enAlternate, platform),
            firstComment: comment(slot.enAlternate),
          }
        : null
      slots.push({
        calendarVersion: calendar.version,
        dayOffset: slot.dayOffset,
        platform,
        videoDay: slot.videoDay,
        lang: slot.lang,
        videoUrl: slot.videoUrl,
        coverUrl: slot.coverUrl,
        scheduledAt: atLocal(day, slot.postTime, calendar.timezone),
        content: contentFor(slot, platform),
        firstComment: comment(slot),
        nativeCheck: slot.nativeCheck ?? null,
        alternate,
      })
    }
  }
  return slots
}
