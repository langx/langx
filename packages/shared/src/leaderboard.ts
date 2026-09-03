import { z } from 'zod'
import { PERIOD_TYPES } from './periods'

export const LEADERBOARD_PAGE_SIZE = 100

export const leaderboardQuerySchema = z.object({
  /** `all` | `year` | `month` | `week` — the four tabs. */
  period: z.enum(PERIOD_TYPES).default('week'),
  /**
   * Which period to read, e.g. `2026-W35`. Defaults to the one in progress;
   * an explicit key is what lets a client show last week's final table.
   */
  periodKey: z.string().trim().min(1).optional(),
  /**
   * Keyset over `{tokens: -1, _id: 1}`, the order the table is already built
   * in. Without it the board stopped at `LEADERBOARD_PAGE_SIZE` and rank 101
   * was unreachable.
   */
  cursor: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(LEADERBOARD_PAGE_SIZE).default(LEADERBOARD_PAGE_SIZE),
})
export type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>

export const leaderboardEntrySchema = z.object({
  /**
   * Competition ranking: equal token shares a rank and the next distinct score
   * skips (1, 2, 2, 4). It has to match how a viewer outside the top N gets
   * their own rank — a count of everyone strictly above them — or the two
   * numbers would disagree on a tie.
   */
  rank: z.number().int(),
  userId: z.string(),
  handle: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().optional(),
  tokens: z.number().int(),
  streak: z.number().int(),
  /**
   * The frame's tone and the title, already resolved.
   *
   * Resolved server-side rather than shipping `cosmetics` and `equipped` for
   * the client to work out: the board is a list of strangers, and sending the
   * whole set each of them owns to draw one ring is a lot of wire for a
   * decision the server has already made everywhere else.
   */
  frame: z.string().optional(),
  title: z.string().optional(),
  isViewer: z.boolean(),
})
export type LeaderboardEntry = z.infer<typeof leaderboardEntrySchema>

export const leaderboardSchema = z.object({
  period: z.enum(PERIOD_TYPES),
  periodKey: z.string(),
  entries: z.array(leaderboardEntrySchema),
  /** `null` on the last page. */
  nextCursor: z.string().nullable(),
  /** The caller's own standing, always present even when outside the page. */
  viewer: z.object({
    rank: z.number().int().nullable(),
    tokens: z.number().int(),
    inPage: z.boolean(),
  }),
})
export type Leaderboard = z.infer<typeof leaderboardSchema>

/**
 * The two ways a streak can be ranked.
 *
 * `current` is the run somebody is holding right now, which is the one that
 * can be lost — and so the one worth showing first. `longest` is what they
 * have ever held, which nothing can take away and which therefore never
 * changes hands from one day to the next.
 */
export const STREAK_METRICS = ['current', 'longest'] as const
export type StreakMetric = (typeof STREAK_METRICS)[number]

/**
 * No cursor and no period, unlike the token board.
 *
 * A streak is not scored per period — it is a property of the account today —
 * so there is nothing for `periodKey` to select. And the board is one page by
 * design: it sits inside a scrolling page rather than owning a list of its
 * own, so a cursor would have nothing to page.
 */
export const streakLeaderboardQuerySchema = z.object({
  metric: z.enum(STREAK_METRICS).default('current'),
  limit: z.coerce.number().int().min(1).max(LEADERBOARD_PAGE_SIZE).default(50),
})
export type StreakLeaderboardQuery = z.infer<typeof streakLeaderboardQuerySchema>

export const streakLeaderboardEntrySchema = z.object({
  /** Competition ranking, on the same terms as the token board. */
  rank: z.number().int(),
  userId: z.string(),
  handle: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().optional(),
  /** Days: whichever of the two metrics was asked for. */
  streak: z.number().int(),
  frame: z.string().optional(),
  title: z.string().optional(),
  isViewer: z.boolean(),
})
export type StreakLeaderboardEntry = z.infer<typeof streakLeaderboardEntrySchema>

export const streakLeaderboardSchema = z.object({
  metric: z.enum(STREAK_METRICS),
  entries: z.array(streakLeaderboardEntrySchema),
  viewer: z.object({
    /** `null` when the viewer has no streak, or has let a live one lapse. */
    rank: z.number().int().nullable(),
    streak: z.number().int(),
    inPage: z.boolean(),
  }),
})
export type StreakLeaderboard = z.infer<typeof streakLeaderboardSchema>
