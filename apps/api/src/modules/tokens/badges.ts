import {
  BADGES,
  TOKEN_RULES,
  streakMilestoneBonus,
  type BadgeKind,
  type BadgeSummary,
  type EarnedBadge,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import { ApiError } from '../../lib/ApiError'
import { countCorrectionsWritten } from './corrections'
import { readAggregates, type TokenLedgerEntry } from './ledger'

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * When each streak milestone was crossed.
 *
 * The ledger does not record *which* milestone a `streak` row paid — only the
 * day it was paid for and the amount. The amount is enough: the payouts in
 * `TOKEN_RULES.streakMilestones` are distinct, so an amount maps back to
 * exactly one milestone. If two milestones were ever given the same payout this
 * would silently attribute both to the earlier row, which is why the mapping is
 * built from the rules rather than hard-coded.
 */
async function streakMilestoneDates(db: Db, userId: string): Promise<Map<number, Date>> {
  const rows = await db
    .collection<TokenLedgerEntry>(COLLECTIONS.tokenLedger)
    .find({ userId, kind: 'streak' })
    .sort({ createdAt: 1 })
    .toArray()

  const byAmount = new Map<number, number>()
  for (const days of Object.keys(TOKEN_RULES.streakMilestones).map(Number)) {
    byAmount.set(streakMilestoneBonus(days), days)
  }

  const dates = new Map<number, Date>()
  for (const row of rows) {
    const days = byAmount.get(row.amount)
    // Earliest wins: a milestone is crossed once, and a re-award would be a bug
    // rather than a second earning.
    if (days !== undefined && !dates.has(days)) dates.set(days, row.createdAt)
  }
  return dates
}

/**
 * Every badge, earned or not, computed from what the profile and ledger already
 * say. Nothing here is stored — see the note on `BADGES`.
 */
export async function getBadgeSummary(
  db: Db,
  userId: string,
  at: Date = new Date(),
): Promise<BadgeSummary> {
  const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
  if (!profile) throw new ApiError('NOT_FOUND', 'Complete onboarding first')

  const [corrections, milestoneDates, aggregates] = await Promise.all([
    countCorrectionsWritten(db, userId),
    streakMilestoneDates(db, userId),
    readAggregates(db, userId),
  ])

  const joinedAt = new Date(profile.createdAt).getTime()
  const memberDays = Math.floor((at.getTime() - joinedAt) / DAY_MS)

  /**
   * Where the user stands on each kind's own scale.
   *
   * A `Record` rather than the `(kind: string) => number` this used to be. That
   * signature took `string`, so a kind added to `BADGE_KINDS` fell through to
   * the corrections branch with no type error and every new badge quietly
   * measured the wrong thing. Written this way, forgetting one does not
   * compile.
   *
   * `streak` reads `longest`, not `current`. A badge is a record of something
   * that happened, and a 100-day streak that has since been broken still
   * happened — reading `current` would take badges away from people, which is
   * the one thing an achievement must never do. Every other entry here is
   * monotonic for the same reason: `messagesSent` is only ever incremented,
   * and `tokenAggregates.all` counts token *earned*, which spending never
   * touches.
   */
  const progress: Record<BadgeKind, number> = {
    streak: profile.streak.longest,
    correction: corrections,
    messages: profile.stats?.messagesSent ?? 0,
    tokens: aggregates.all,
    veteran: memberDays,
  }

  /**
   * The date a badge was earned, where that is knowable at all.
   *
   * A streak milestone has the ledger row that paid it. A veteran badge is
   * arithmetic — the account's birthday plus its own threshold — and is worth
   * computing because it is exact. The counting kinds have nothing: the count
   * is a total, and nothing records which correction was the thousandth.
   */
  function earnedAtOf(kind: BadgeKind, threshold: number): string | null {
    if (kind === 'streak') return milestoneDates.get(threshold)?.toISOString() ?? null
    if (kind === 'veteran') {
      return new Date(joinedAt + threshold * DAY_MS).toISOString()
    }
    return null
  }

  const badges: EarnedBadge[] = BADGES.map((badge) => {
    const earned = progress[badge.kind] >= badge.threshold
    return {
      id: badge.id,
      kind: badge.kind,
      threshold: badge.threshold,
      label: badge.label,
      icon: badge.icon,
      earned,
      earnedAt: earned ? earnedAtOf(badge.kind, badge.threshold) : null,
    }
  })

  /**
   * The badge the user is furthest along towards, by fraction rather than by
   * position in `BADGES`.
   *
   * Taking the first unearned entry was defensible while there were two kinds
   * and all of one came before all of the other. With five it is actively
   * wrong: somebody one correction short of a badge would be shown a
   * three-year streak instead. Ties go to the smaller threshold, so the
   * cheaper of two equally-close badges is the one offered.
   */
  const nextDefinition = BADGES.filter((badge) => progress[badge.kind] < badge.threshold).sort(
    (a, b) => {
      const byFraction = progress[b.kind] / b.threshold - progress[a.kind] / a.threshold
      return byFraction !== 0 ? byFraction : a.threshold - b.threshold
    },
  )[0]

  const next = nextDefinition
    ? {
        id: nextDefinition.id,
        kind: nextDefinition.kind,
        label: nextDefinition.label,
        current: progress[nextDefinition.kind],
        threshold: nextDefinition.threshold,
        // Only the streak milestones pay; every other kind is recognition only.
        reward:
          nextDefinition.kind === 'streak' ? streakMilestoneBonus(nextDefinition.threshold) : 0,
      }
    : null

  return { badges, earnedCount: badges.filter((badge) => badge.earned).length, next }
}
