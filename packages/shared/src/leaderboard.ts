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
