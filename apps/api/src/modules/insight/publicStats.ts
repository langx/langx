import { getLanguage } from '@langx/shared'
import type { Db, Document, Filter } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'

/**
 * The numbers behind the public page at `insight.langx.io`.
 *
 * What may be on this page is decided in `docs/decisions.md` → _The analytics
 * dashboard is private_: users, languages, messages, corrections and streaks,
 * and **no revenue, conversion or funnel**. That is not a styling preference —
 * publishing a conversion rate hands pricing and channel strategy away
 * permanently, and it is why the internal dashboard is PostHog's and this is a
 * different artefact with a different audience. Anything added here has to
 * survive that sentence.
 *
 * Everything below is a count over a whole collection. No document is ever
 * read out, nothing is keyed by a person, and the smallest group here is a
 * language — so there is no row a stranger could narrow to one account.
 */

/** The window the page draws, and Plausible's default range. */
export const WINDOW_DAYS = 30
/** Rows per top list. Eight fits the two columns without a scrollbar. */
const TOP_LANGUAGES = 8
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * How long an answer is reused. Every field here is a collection scan, the
 * page is public and cacheable by anyone, and nothing on it is worth a
 * database pass per visitor: ten minutes bounds the cost to six passes an
 * hour however many people are reading.
 */
export const PUBLIC_STATS_TTL_MS = 10 * 60 * 1000

export interface LanguageCount {
  code: string
  /** The English name, resolved here so the page needs no language table. */
  name: string
  count: number
}

export interface DailyPoint {
  /** `YYYY-MM-DD`, UTC. */
  day: string
  members: number
  messages: number
  corrections: number
}

export interface PublicStats {
  /** When the numbers were computed, not when they were served. */
  generatedAt: string
  days: number
  totals: { members: number; messages: number; corrections: number; languages: number }
  streaks: { longest: number; active: number }
  /** One entry per day of the window, zeros included — a chart needs the gaps. */
  daily: DailyPoint[]
  learning: LanguageCount[]
  native: LanguageCount[]
}

/**
 * A real account, still here. Guests are browsing sessions with no account
 * behind them (see `Profile.guest`) and would inflate every number on the
 * page; a deleted account is gone even while its 30-day grace row remains.
 */
const LIVE_MEMBERS: Filter<Document> = { guest: { $exists: false }, deletedAt: { $exists: false } }

/** Midnight UTC on the first day the page draws. */
function windowStart(now: Date, days: number): Date {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return new Date(today - (days - 1) * DAY_MS)
}

/** The window's days, oldest first, so a day nobody joined is a zero and not a gap. */
function dayKeys(start: Date, days: number): string[] {
  return Array.from({ length: days }, (_, i) =>
    new Date(start.getTime() + i * DAY_MS).toISOString().slice(0, 10),
  )
}

/**
 * Rows per UTC day for one collection.
 *
 * UTC rather than a viewer's timezone: the page is one document served from a
 * cache to everybody, so a day boundary that moved per reader would make the
 * same bar hold two different numbers.
 */
async function perDay(
  db: Db,
  collection: string,
  since: Date,
  match: Filter<Document>,
): Promise<Map<string, number>> {
  const rows = await db
    .collection(collection)
    .aggregate<{ _id: string; n: number }>([
      { $match: { ...match, createdAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
          n: { $sum: 1 },
        },
      },
    ])
    .toArray()
  return new Map(rows.map((row) => [row._id, row.n]))
}

/** The most spoken or most studied languages, by how many members list each. */
async function topLanguages(
  db: Db,
  field: 'learning' | 'nativeLanguages',
): Promise<LanguageCount[]> {
  const rows = await db
    .collection(COLLECTIONS.profiles)
    .aggregate<{ _id: string; n: number }>([
      { $match: LIVE_MEMBERS },
      { $unwind: `$${field}` },
      { $group: { _id: `$${field}.code`, n: { $sum: 1 } } },
      { $sort: { n: -1, _id: 1 } },
      { $limit: TOP_LANGUAGES },
    ])
    .toArray()
  return rows.map(({ _id, n }) => ({
    code: _id,
    // A code the table does not know is shown as itself rather than dropped:
    // a language that stopped resolving is a bug to see, not one to hide.
    name: getLanguage(_id)?.name ?? _id,
    count: n,
  }))
}

/** How many distinct languages are being learned at all — the headline "languages". */
async function distinctLearning(db: Db): Promise<number> {
  const [row] = await db
    .collection(COLLECTIONS.profiles)
    .aggregate<{ n: number }>([
      { $match: LIVE_MEMBERS },
      { $unwind: '$learning' },
      { $group: { _id: '$learning.code' } },
      { $count: 'n' },
    ])
    .toArray()
  return row?.n ?? 0
}

async function streakTotals(db: Db): Promise<{ longest: number; active: number }> {
  const [row] = await db
    .collection(COLLECTIONS.profiles)
    .aggregate<{ longest: number | null; active: number }>([
      { $match: LIVE_MEMBERS },
      {
        $group: {
          _id: null,
          longest: { $max: '$streak.longest' },
          active: { $sum: { $cond: [{ $gt: ['$streak.current', 0] }, 1, 0] } },
        },
      },
    ])
    .toArray()
  return { longest: row?.longest ?? 0, active: row?.active ?? 0 }
}

async function computePublicStats(db: Db, now: Date): Promise<PublicStats> {
  const since = windowStart(now, WINDOW_DAYS)
  const keys = dayKeys(since, WINDOW_DAYS)

  const [
    members,
    messages,
    corrections,
    languages,
    streaks,
    newMembers,
    sentMessages,
    madeCorrections,
    learning,
    native,
  ] = await Promise.all([
    db.collection(COLLECTIONS.profiles).countDocuments(LIVE_MEMBERS),
    db.collection(COLLECTIONS.messages).countDocuments({}),
    db.collection(COLLECTIONS.postCorrections).countDocuments({}),
    distinctLearning(db),
    streakTotals(db),
    perDay(db, COLLECTIONS.profiles, since, LIVE_MEMBERS),
    perDay(db, COLLECTIONS.messages, since, {}),
    perDay(db, COLLECTIONS.postCorrections, since, {}),
    topLanguages(db, 'learning'),
    topLanguages(db, 'nativeLanguages'),
  ])

  return {
    generatedAt: now.toISOString(),
    days: WINDOW_DAYS,
    totals: { members, messages, corrections, languages },
    streaks,
    daily: keys.map((day) => ({
      day,
      members: newMembers.get(day) ?? 0,
      messages: sentMessages.get(day) ?? 0,
      corrections: madeCorrections.get(day) ?? 0,
    })),
    learning,
    native,
  }
}

/**
 * The last answer, per process. Two machines serve this route and each keeps
 * its own — the numbers are the same to within the TTL, and a shared cache
 * would be a second thing to keep alive for a page nobody is paged about.
 */
let memory: { at: number; stats: PublicStats } | null = null

/** Test only: forget the kept answer, so a case starts from the database. */
export function resetPublicStatsCache(): void {
  memory = null
}

export async function readPublicStats(db: Db, now: Date = new Date()): Promise<PublicStats> {
  if (memory && now.getTime() - memory.at < PUBLIC_STATS_TTL_MS) return memory.stats
  const stats = await computePublicStats(db, now)
  memory = { at: now.getTime(), stats }
  return stats
}
