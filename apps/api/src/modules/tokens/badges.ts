import {
  BADGES,
  TOKEN_RULES,
  streakMilestoneBonus,
  type BadgeSummary,
  type EarnedBadge,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import { ApiError } from '../../lib/ApiError'
import { countCorrectionsWritten } from './corrections'
import type { TokenLedgerEntry } from './ledger'

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
export async function getBadgeSummary(db: Db, userId: string): Promise<BadgeSummary> {
  const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
  if (!profile) throw new ApiError('NOT_FOUND', 'Complete onboarding first')

  const [corrections, milestoneDates] = await Promise.all([
    countCorrectionsWritten(db, userId),
    streakMilestoneDates(db, userId),
  ])

  /**
   * `longest`, not `current`. A badge is a record of something that happened,
   * and a 100-day streak that has since been broken still happened — reading
   * `current` would take badges away from people, which is the one thing an
   * achievement must never do.
   */
  const progressOf = (kind: string): number =>
    kind === 'streak' ? profile.streak.longest : corrections

  const badges: EarnedBadge[] = BADGES.map((badge) => {
    const earned = progressOf(badge.kind) >= badge.threshold
    const at = badge.kind === 'streak' ? milestoneDates.get(badge.threshold) : undefined
    return {
      id: badge.id,
      kind: badge.kind,
      threshold: badge.threshold,
      label: badge.label,
      earned,
      // Only streak badges can date themselves; nothing records which
      // correction was the thousandth.
      earnedAt: earned && at ? at.toISOString() : null,
    }
  })

  const nextDefinition = BADGES.find((badge) => progressOf(badge.kind) < badge.threshold)
  const next = nextDefinition
    ? {
        id: nextDefinition.id,
        kind: nextDefinition.kind,
        label: nextDefinition.label,
        current: progressOf(nextDefinition.kind),
        threshold: nextDefinition.threshold,
        // Correction badges pay nothing; only the streak milestones do.
        reward:
          nextDefinition.kind === 'streak' ? streakMilestoneBonus(nextDefinition.threshold) : 0,
      }
    : null

  return { badges, earnedCount: badges.filter((badge) => badge.earned).length, next }
}
