import {
  BADGES,
  TOKEN_RULES,
  isCohortBadge,
  isV3BadgeKind,
  PINNED_BADGES_MAX,
  type BadgeCatalogue,
  streakMilestoneBonus,
  type BadgeKind,
  type BadgeSummary,
  type EarnedBadge,
  type PublicBadges,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import { ApiError } from '../../lib/ApiError'
import { cameFromV1 } from '../handles/legacyPrecreate'
import {
  countEchoReviews,
  countLanguagesPractised,
  countLongCalls,
  countPeopleHelped,
  countTestimonialsAbout,
} from './badgeCounts'
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

/** The six v3 counts, read only for a caller that asked for the v3 catalogue. */
async function readV3Counts(db: Db, userId: string, profile: Profile) {
  const [echo, testimonials, calls, guide, languages] = await Promise.all([
    countEchoReviews(db, userId),
    countTestimonialsAbout(db, userId),
    countLongCalls(db, userId),
    countPeopleHelped(db, userId),
    countLanguagesPractised(
      db,
      userId,
      (profile.nativeLanguages ?? []).map((language) => language.code),
    ),
  ])
  return { echo, testimonials, calls, guide, languages }
}

/**
 * Every badge, earned or not, computed from what the profile and ledger already
 * say. Nothing here is stored — see the note on `BADGES`.
 *
 * `catalogue` decides whether the six kinds added with the v3 shelf are in
 * it. `classic` — the default, and what every caller but the v3 screen gets —
 * is the twenty-five badges older builds know: an app that has never heard of
 * `calls` would label it by indexing a table that has no row for it, so a new
 * kind reaches only a client that asked for it (`?catalogue=v3`). The evening
 * round-up stays on `classic` until `BADGE_ROUND_UP_CATALOGUE` says otherwise.
 * Classic also skips the five extra reads.
 */
export async function getBadgeSummary(
  db: Db,
  userId: string,
  at: Date = new Date(),
  catalogueName: BadgeCatalogue = 'classic',
): Promise<BadgeSummary> {
  const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
  if (!profile) throw new ApiError('NOT_FOUND', 'Complete onboarding first')
  const v3 = catalogueName === 'v3'

  const [corrections, milestoneDates, aggregates, fromV1, more] = await Promise.all([
    countCorrectionsWritten(db, userId),
    streakMilestoneDates(db, userId),
    readAggregates(db, userId),
    // A point read on `user._id`, and inside the same `Promise.all` as the
    // three above so it costs no round-trip. See `progress.origin`.
    cameFromV1(db, userId),
    v3 ? readV3Counts(db, userId, profile) : null,
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
    /**
     * A boolean wearing a number, so the one `>=` below still serves every
     * kind. Monotonic like the rest: `precreatedFromV1` is written once by a
     * script that will never run again, and the v1 cohort is closed.
     *
     * Read from `user.precreatedFromV1` and not `profile.restoredFromV1`,
     * which is already in hand and would be free. `restoredFromV1` exists only
     * where a v1 profile was *staged*; `precreate-v1-users.ts` also opened rows
     * for v1 auth users with nothing to stage, so it under-counts the cohort it
     * looks like it names, and the people it misses are exactly the ones with
     * least to show for having been here.
     */
    origin: fromV1 ? 1 : 0,
    /*
     * The v3 kinds. Zero when the catalogue is classic, where they are
     * dropped below and nobody reads these. `openers` is a profile counter
     * like `messagesSent`, so it is free either way; it began counting when
     * the stat did, and is retroactive only that far.
     */
    languages: more?.languages ?? 0,
    calls: more?.calls ?? 0,
    echo: more?.echo ?? 0,
    testimonials: more?.testimonials ?? 0,
    guide: more?.guide ?? 0,
    openers: v3 ? (profile.stats?.openersAnsweredWithinDay ?? 0) : 0,
  }

  /**
   * The catalogue this account is shown.
   *
   * A cohort badge that is not theirs is dropped rather than sent locked, and
   * both halves of that matter. `next` cannot offer a badge nobody can go and
   * earn — a non-v1 account one correction short would otherwise be pointed at
   * v1 the moment the fractions happened to tie — and the grid cannot draw a
   * row reading "Locked" under a promise this app will never keep. For
   * everybody who does have it, and for every counting kind, this is `BADGES`.
   */
  const catalogue = BADGES.filter(
    (badge) =>
      (v3 || !isV3BadgeKind(badge.kind)) &&
      (!isCohortBadge(badge.kind) || progress[badge.kind] >= badge.threshold),
  )

  /**
   * The date a badge was earned, where that is knowable at all.
   *
   * A streak milestone has the ledger row that paid it. A veteran badge is
   * arithmetic — the account's birthday plus its own threshold — and is worth
   * computing because it is exact. The counting kinds have nothing: the count
   * is a total, and nothing records which correction was the thousandth.
   *
   * Nor does `origin`, deliberately. The date it was earned is a date in v1
   * that this database does not hold; `precreatedFromV1.at` is the day a
   * script ran, and dating the badge to that is a lie shaped like a fact.
   */
  function earnedAtOf(kind: BadgeKind, threshold: number): string | null {
    if (kind === 'streak') return milestoneDates.get(threshold)?.toISOString() ?? null
    if (kind === 'veteran') {
      return new Date(joinedAt + threshold * DAY_MS).toISOString()
    }
    return null
  }

  const badges: EarnedBadge[] = catalogue.map((badge) => {
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
  const nextDefinition = catalogue
    .filter((badge) => progress[badge.kind] < badge.threshold)
    .sort((a, b) => {
      const byFraction = progress[b.kind] / b.threshold - progress[a.kind] / a.threshold
      return byFraction !== 0 ? byFraction : a.threshold - b.threshold
    })[0]

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

  // Counting kinds only: a cohort is a fact, and a fraction of one is not a
  // sentence anybody can act on.
  const progressByKind: Record<string, number> = {}
  for (const kind of Object.keys(progress) as BadgeKind[]) {
    if (!isCohortBadge(kind) && (v3 || !isV3BadgeKind(kind))) progressByKind[kind] = progress[kind]
  }

  return {
    badges,
    earnedCount: badges.filter((badge) => badge.earned).length,
    next,
    progress: progressByKind,
    pinned: profile.pinnedBadgeIds ?? [],
  }
}

/**
 * Pins up to `PINNED_BADGES_MAX` badges to the profile, replacing the last
 * choice. Every id must be a badge this account has earned — checked against
 * the v3 catalogue, the only screen that pins — and a repeat is dropped.
 * Pinning grants nothing and costs nothing.
 */
export async function pinBadges(
  db: Db,
  userId: string,
  ids: readonly string[],
): Promise<{ pinned: string[] }> {
  const unique = [...new Set(ids)].slice(0, PINNED_BADGES_MAX)
  if (unique.length > 0) {
    const summary = await getBadgeSummary(db, userId, new Date(), 'v3')
    const earned = new Set(summary.badges.filter((badge) => badge.earned).map((b) => b.id))
    const stranger = unique.find((id) => !earned.has(id))
    if (stranger)
      throw new ApiError('VALIDATION_FAILED', 'Only a badge you have earned can be pinned')
  }
  await db
    .collection<Profile>(COLLECTIONS.profiles)
    .updateOne({ _id: userId }, { $set: { pinnedBadgeIds: unique } })
  return { pinned: unique }
}

/**
 * Somebody else's badges: the ones they have, and how many there were to have.
 *
 * A filter over `getBadgeSummary` rather than a second derivation of the same
 * facts, so their page and their own can never disagree about what they have
 * earned. What it drops — the locked rows and `next` — is dropped because it
 * is progress rather than achievement; see `publicBadgesSchema`.
 */
export async function getPublicBadges(
  db: Db,
  userId: string,
  catalogue: BadgeCatalogue = 'classic',
): Promise<PublicBadges> {
  const summary = await getBadgeSummary(db, userId, new Date(), catalogue)
  return {
    badges: summary.badges.filter((badge) => badge.earned),
    earnedCount: summary.earnedCount,
    // Before the filter: the catalogue this account is measured against, which
    // is short by one for anybody who did not come from v1.
    total: summary.badges.length,
  }
}
