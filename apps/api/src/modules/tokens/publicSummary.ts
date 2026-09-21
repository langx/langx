import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import { readActivityWeek } from './dailyActivity'
import { getBadgeSummary } from './badges'
import { countCorrectionsWritten } from './corrections'
import { readAggregates, type TokenAggregate } from './ledger'
import { badgeStripMarks, periodKeys, type ProfileBadge } from '@langx/shared'

/**
 * What a profile shows about how somebody uses the app: the streak, how many
 * corrections they have written, which badges they hold, how many tokens they
 * have earned — and, if they allow it, the week's shape.
 *
 * A deliberately smaller thing than `getTokenSummary`, which is the owner's
 * view: no wallet, no quota, no per-day counters, nothing about what was
 * bought.
 *
 * The numbers are always sent. They are a record of teaching people,
 * which is the point of the product, and they sit at the top of a profile the
 * way a follower count does — there used to be a "show my numbers" switch,
 * and it went because a profile with the counts missing read as a profile
 * with something to hide. The chart is different: not how much somebody has
 * done but which days they were around this week, which is a detail a person
 * may reasonably keep to themselves. `privacy.weekChartVisible` turns it off,
 * and when it is off `week` is not sent at all rather than hidden by the
 * client.
 */
export interface PublicSummary {
  streak: { current: number; longest: number }
  corrections: number
  /**
   * The newest badge of each kind, for the strip above the bio — see
   * `badgeStripMarks` for why a climbed ladder sends one mark and not four.
   *
   * Carried here rather than fetched from `/profiles/:handle/badges` when the
   * strip renders. This function already derives the whole shelf and keeps
   * one mark per kind of it; asking a second endpoint to derive it again
   * would be a round trip bought with work already done.
   *
   * There is no count beside it. The strip used to carry one for the badges
   * past the end of the row, and there are none: the shelf it opens draws the
   * tips of the same ladders, so the difference is always zero.
   */
  topBadges: ProfileBadge[]
  tokens: number
  /**
   * Where they stand on this week's token board, as a top-N%, or `null` when
   * they have earned nothing this week and are not on it.
   *
   * A percentile and not the rank itself. "#3" is worth reading and "#41,205"
   * is a number nobody wants under their face — and the second is what almost
   * every profile would carry. The dilution also fixes itself as the app
   * grows, which a raw position does the opposite of.
   *
   * **This week, not all time**, and the reason is the screen it opens: the
   * token board offers week, month and year and does not ask the API for
   * `all`. A lifetime percentile would send the reader to a table that has no
   * such column. The week is also the timeframe the profile already publishes
   * right below this, in the activity chart.
   */
  rank: { percentile: number } | null
  /** Their days, not the reader's — the window follows the profile's zone. */
  week?: { day: string; messages: number; corrections: number }[]
}

/** `null` when there is no such profile; the route has already checked. */
export async function getPublicSummary(
  db: Db,
  userId: string,
  at: Date = new Date(),
): Promise<PublicSummary | null> {
  const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
  if (!profile) return null
  // Absent means on: the flag is newer than the profiles that predate it.
  const chart = profile.privacy?.weekChartVisible !== false

  // The week is read only when it will be sent: it is its own query, and a
  // switched-off chart should not cost the page a lookup that is thrown away.
  const [tokens, corrections, badges, week] = await Promise.all([
    readAggregates(db, userId, at),
    countCorrectionsWritten(db, userId),
    getBadgeSummary(db, userId, at),
    chart ? readActivityWeek(db, userId, at, profile.timezone ?? 'UTC') : undefined,
  ])

  return {
    streak: { current: profile.streak.current, longest: profile.streak.longest },
    corrections,
    rank: await weekPercentile(db, tokens.week, at),
    /*
     * Which badges is no longer only the owner's page — the strip draws the
     * newest of each kind, and `/profiles/:handle/badges` has published the
     * earned ones since the tiles learned to open. What stays the owner's
     * alone is the locked half and how far along it they are.
     *
     * Filtered before `badgeStripMarks` rather than inside it: a locked rung
     * is the newest of nothing, and letting one reach the dedupe would let it
     * take a kind's place from the badge actually earned under it.
     *
     * This is where the strip and the badge page part company on order: the
     * page is a catalogue and reads as one, the strip is a glimpse and leads
     * with what just happened.
     */
    topBadges: badgeStripMarks(badges.badges.filter((badge) => badge.earned)).map((badge) => ({
      id: badge.id,
      kind: badge.kind,
      icon: badge.icon,
    })),
    // The all-time total, which is what the owner's own profile shows too —
    // not the balance, which moves when they spend and is nobody else's
    // business.
    tokens: tokens.all,
    ...(week ? { week } : {}),
  }
}

/**
 * How far up this week's token board somebody's total puts them, as a
 * percentage rounded up.
 *
 * Counted over raw aggregate rows, exactly as `getLeaderboard` counts the
 * viewer's own rank — no `deletedAt` filter and no block filter. That is
 * deliberate rather than overlooked: a deleted account keeps its place so the
 * ranks below it do not shift, and blocking somebody must not promote you past
 * them. Counting differently here would tell one person two positions.
 *
 * `Math.ceil` so nobody is ever told they are the top 0% of anything. The
 * price is at the other end of a small board: first of twenty-five is top 4%,
 * not top 1%, because that is what it is. The alternative — pinning rank 1 to
 * "top 1%" — would be the one number here that flatters rather than reports,
 * and it stops mattering entirely once the board outgrows a hundred people.
 */
async function weekPercentile(
  db: Db,
  weekTokens: number,
  at: Date,
): Promise<{ percentile: number } | null> {
  // Nothing earned this week is not a position; it is an absence from the
  // board, the same answer `getLeaderboard` gives the viewer in that case.
  if (weekTokens <= 0) return null

  const periodKey = periodKeys(at).week
  const aggregates = db.collection<TokenAggregate>(COLLECTIONS.tokenAggregates)
  const [above, total] = await Promise.all([
    aggregates.countDocuments({ periodType: 'week', periodKey, tokens: { $gt: weekTokens } }),
    aggregates.countDocuments({ periodType: 'week', periodKey, tokens: { $gt: 0 } }),
  ])

  // `total` includes this user, so it is at least 1 and the division is safe.
  return { percentile: Math.min(100, Math.max(1, Math.ceil(((above + 1) / total) * 100))) }
}
