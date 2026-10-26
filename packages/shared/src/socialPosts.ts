import { z } from 'zod'

/**
 * Venus's day videos, posted to LangX's own social accounts by the API, behind
 * `flags.socialAutopost`. See `docs/social-autoposting.md`.
 *
 * One row per (calendar slot, platform). The operator approves the calendar
 * once; after that the scheduler posts every approved row at its time, and
 * the switch is how all of it stops.
 */
export const SOCIAL_PLATFORMS = ['instagram', 'facebook', 'youtube', 'tiktok'] as const
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]

/**
 * The life of one row. `draft` is what an import writes and nothing posts it;
 * `approved` is the operator's yes and the only state the scheduler takes;
 * `publishing` is its claim, so two passes cannot post the same row; `failed`
 * keeps why; `skipped` is the operator's no.
 */
export const SOCIAL_POST_STATUSES = [
  'draft',
  'approved',
  'publishing',
  'published',
  'failed',
  'skipped',
] as const
export type SocialPostStatus = (typeof SOCIAL_POST_STATUSES)[number]

export const SOCIAL_AUTOPOST_RULES = {
  /**
   * Claims of one row before it is given up on. Only a failure that certainly
   * posted nothing is tried again; one that may have posted never is.
   */
  maxAttempts: 3,
  /** The wait before each retry, in minutes: after the first failure, then the second. */
  backoffMinutes: [5, 30],
  /**
   * How late a row may still go out. Past this it fails as missed rather than
   * posting: a switch left off for a week, or an API down overnight, must not
   * come back as a week of videos in one minute. The calendar is one a day,
   * so the afternoon is still the day and tomorrow is not.
   */
  maxLateMinutes: 6 * 60,
  /**
   * How long a claim may sit in `publishing` before it is presumed dead. Far
   * longer than any platform takes to process a twelve-second video, and it
   * fails rather than retries: the process may have died after the platform
   * had already posted.
   */
  staleClaimMinutes: 30,
} as const

/** The words one platform shows: a caption with hashtags, or YouTube's three fields. */
export interface SocialPostContent {
  caption?: string
  hashtags?: string[]
  title?: string
  description?: string
  tags?: string[]
}

/**
 * The caption Instagram, Facebook and TikTok are sent: the words, a blank
 * line, then the hashtags. The calendar keeps the two apart so a reviewer
 * reads the caption as it reads; this is where they meet — in the
 * API's adapters, its dry run, and the panel's text to paste into TikTok.
 */
export function captionWithHashtags(content: SocialPostContent): string {
  return [content.caption?.trim() ?? '', (content.hashtags ?? []).join(' ').trim()]
    .filter((part) => part.length > 0)
    .join('\n\n')
}

/** A row as the operator panel sees it. */
export interface SocialPostDto {
  _id: string
  calendarVersion: number
  dayOffset: number
  videoDay: number
  platform: SocialPlatform
  lang: string
  videoUrl: string
  coverUrl: string
  scheduledAt: string
  status: SocialPostStatus
  content: SocialPostContent
  firstComment: string | null
  /** Set when a native speaker must read the swap before it may post. */
  nativeCheck: string | null
  attempts: number
  lastError: string | null
  /** Something to know about a post that did go out — the TikTok inbox, a first comment that failed. */
  note: string | null
  platformPostId: string | null
  platformUrl: string | null
  publishedAt: string | null
}

export interface AdminSocialPostsDto {
  /** `flags.socialAutopost`: off, nothing posts whatever is approved. */
  enabled: boolean
  /** Which platforms this API holds credentials for. */
  connected: Record<SocialPlatform, boolean>
  /** Not yet posted, soonest first. */
  upcoming: SocialPostDto[]
  /** Posted, failed or skipped, latest first. */
  recent: SocialPostDto[]
}

export const adminSocialPostsQuerySchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS).optional(),
})
export type AdminSocialPostsQuery = z.infer<typeof adminSocialPostsQuerySchema>

/**
 * What the panel can do to one row. `approve` takes a draft or a skipped row;
 * `skip` takes anything not yet out; `retry` takes a failed one, at once.
 */
export const SOCIAL_POST_ACTIONS = ['approve', 'skip', 'retry'] as const
export type SocialPostAction = (typeof SOCIAL_POST_ACTIONS)[number]

export const adminSocialPostActionSchema = z.strictObject({
  action: z.enum(SOCIAL_POST_ACTIONS),
})
export type AdminSocialPostActionInput = z.infer<typeof adminSocialPostActionSchema>
