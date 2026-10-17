import {
  ACTIVATION_RULES,
  ADMIN_MEASURE_WEEKS_DEFAULT,
  FIRST_MESSAGE_RULES,
  OFFICIAL_HANDLES,
  RETURN_RECORDED_FROM,
  weekStartKey,
  type AdminMeasure,
} from '@langx/shared'
import type { Db, Document } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { QUOTA_REFUSAL_WINDOW_MS } from '../../lib/quota'
import type { Profile } from '../profiles/profiles'
import {
  planReturns,
  tallyCohorts,
  tallyFirstMessages,
  tallyRefusals,
  twoWayInstants,
  weekStartsFrom,
  type CohortMember,
  type RefusalRow,
  type Thread,
} from './measureCompute'
import type { StreakDay } from '../tokens/streakDays'

/**
 * Cohorts, first messages and refusals — read from what the server already
 * keeps, and bounded.
 *
 * **Why these queries are shaped the way they are.** This runs against a small
 * shared-tier cluster that is also serving the app, and the panel is opened by
 * hand: every read here has a date range on an index (`joined` on profiles,
 * `first_message_at` on conversations, `quota_refusals` on profiles) or goes
 * by `_id`, and every one has a ceiling. When a ceiling is hit the answer says
 * so (`truncated`) instead of quietly covering less than it claims.
 *
 * **Where each number comes from**, since "from the data we have" is only
 * honest if it says which data:
 *
 * - *Sign-ups*: `profiles.createdAt`. Guests, official accounts and deleted
 *   accounts are out — they are not people who could be retained.
 * - *Returned on Day N*: a `streakDays` document for the Nth local day after
 *   the one they joined on, other than a bought one. That collection is the
 *   only record of which days a person showed up, and a day with only a visit
 *   in it was recorded from `RETURN_RECORDED_FROM` — earlier days are not
 *   measured.
 * - *Activated*: two conversations that became two-way (the person who did not
 *   open it wrote back) inside 72 hours of sign-up. `conversations` has
 *   `bothSpoke` but no time, so the time is the first message in the thread
 *   from someone other than the opener, read from `messages`.
 * - *Unanswered, time to reply*: the same first replies, by the week the
 *   conversation was opened.
 * - *Refusals*: `profiles.quotaRefusals` and `quotaRefusalKinds`, which keep
 *   three days and no more.
 *
 * Nothing here may be re-exported to `modules/insight/publicStats.ts`: retention
 * and activation are the numbers `docs/insight.md` keeps off the public page.
 */

/** Long enough that opening the screen twice is one set of reads, short enough to be today's. */
export const ADMIN_MEASURE_TTL_MS = 5 * 60 * 1000

/** Ceilings on what one read pulls in. Far above a small app's weeks; a guard, not a limit anyone meets. */
const MEMBER_CAP = 20_000
const THREAD_CAP = 20_000
const REFUSAL_PROFILE_CAP = 5_000
/** `_id`s per `$in`, so one query never carries an unbounded list. */
const ID_CHUNK = 1_000

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

const memory = new Map<number, { at: number; measure: AdminMeasure }>()

/** For the tests, and for anything that has just written what it wants to read. */
export function forgetAdminMeasure(): void {
  memory.clear()
}

export async function readAdminMeasure(
  db: Db,
  weeks: number = ADMIN_MEASURE_WEEKS_DEFAULT,
  now: Date = new Date(),
): Promise<AdminMeasure> {
  const cached = memory.get(weeks)
  if (cached && now.getTime() - cached.at < ADMIN_MEASURE_TTL_MS) return cached.measure
  const measure = await computeAdminMeasure(db, weeks, now)
  memory.set(weeks, { at: now.getTime(), measure })
  return measure
}

/** The first instant of the oldest week asked for. */
function firstWeekStart(now: Date, weeks: number): Date {
  const current = new Date(`${weekStartKey(now)}T00:00:00.000Z`)
  return new Date(current.getTime() - (weeks - 1) * WEEK_MS)
}

async function computeAdminMeasure(db: Db, weeks: number, now: Date): Promise<AdminMeasure> {
  const from = firstWeekStart(now, weeks)
  const weekKeys = weekStartsFrom(from, now)

  const officialIds = await officialAccountIds(db)
  const [members, threads, refusalRows] = await Promise.all([
    readCohortMembers(db, from),
    readThreads(db, from, officialIds),
    readRefusalRows(db, now),
  ])

  const plan = planReturns(members.rows, now)
  const returned = await readReturnedDays(db, plan)

  const cohorts = tallyCohorts({
    weeks: weekKeys,
    members: members.rows,
    plan,
    returned,
    twoWay: twoWayInstants(threads.rows),
    now,
  })
  const firstMessages = tallyFirstMessages({ weeks: weekKeys, threads: threads.rows, now })

  return {
    generatedAt: now.toISOString(),
    from: weekStartKey(from),
    weeks,
    rules: {
      activationConversations: ACTIVATION_RULES.conversations,
      activationWindowHours: ACTIVATION_RULES.windowHours,
      unansweredAfterHours: FIRST_MESSAGE_RULES.unansweredAfterHours,
      returnRecordedFrom: RETURN_RECORDED_FROM,
    },
    cohorts: cohorts.rows,
    cohortTotals: cohorts.totals,
    firstMessages: firstMessages.rows,
    firstMessageTotals: firstMessages.totals,
    refusals: {
      windowDays: Math.round(QUOTA_REFUSAL_WINDOW_MS / (24 * 60 * 60 * 1000)),
      kinds: tallyRefusals(refusalRows),
    },
    truncated: members.truncated || threads.truncated,
  }
}

/**
 * Our own voices. Found by handle, which has a unique index, because a scan
 * for `official: true` would walk every profile to find two.
 */
async function officialAccountIds(db: Db): Promise<string[]> {
  const rows = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find({ handle: { $in: [...OFFICIAL_HANDLES] } }, { projection: { _id: 1 } })
    .toArray()
  return rows.map((row) => row._id)
}

/**
 * Everyone who signed up since `from`, newest first so that a ceiling cuts the
 * oldest week and not the one being watched.
 */
async function readCohortMembers(
  db: Db,
  from: Date,
): Promise<{ rows: CohortMember[]; truncated: boolean }> {
  const found = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find(
      {
        createdAt: { $gte: from },
        guest: { $exists: false },
        official: { $exists: false },
        deletedAt: { $exists: false },
      },
      { projection: { createdAt: 1, timezone: 1 } },
    )
    .sort({ createdAt: -1 })
    .limit(MEMBER_CAP + 1)
    .toArray()
  return {
    rows: found.slice(0, MEMBER_CAP).map((profile) => ({
      id: profile._id,
      createdAt: profile.createdAt,
      timeZone: profile.timezone ?? 'UTC',
    })),
    truncated: found.length > MEMBER_CAP,
  }
}

/**
 * The days these people were back, as the set of `streakDays` ids that exist.
 *
 * By `_id`, so every query rides the primary index, in chunks so none carries
 * an unbounded list. A bought day (`source: 'purchase'`) is somebody paying to
 * mend a streak, not somebody being there, and does not count.
 */
async function readReturnedDays(
  db: Db,
  plan: ReadonlyMap<string, readonly { id: string }[]>,
): Promise<Set<string>> {
  const ids = [...plan.values()].flatMap((lookups) => lookups.map((lookup) => lookup.id))
  const found = new Set<string>()
  const days = db.collection<StreakDay>(COLLECTIONS.streakDays)
  for (let start = 0; start < ids.length; start += ID_CHUNK) {
    const rows = await days
      .find(
        { _id: { $in: ids.slice(start, start + ID_CHUNK) }, source: { $ne: 'purchase' } },
        { projection: { _id: 1 } },
      )
      .toArray()
    for (const row of rows) found.add(row._id)
  }
  return found
}

interface ThreadRow {
  _id: unknown
  participants: [string, string]
  firstMessageAt: Date
  bothSpoke?: boolean
}

/**
 * Conversations opened since `from` between two people, each with the instant
 * it became two-way if it has.
 *
 * Two reads rather than one join over everything: the cheap one lists the
 * conversations, and the join runs only over those that are two-way, since the
 * rest have no reply to find. The join asks `messages` for the earliest message
 * in the thread that its opener did not write, which the
 * `conversation_created` index walks from the start of the thread and stops
 * at — a reply is nearly always the second or third row.
 *
 * A call's row is not a reply: it records something that happened to both
 * people, not something one of them said.
 */
async function readThreads(
  db: Db,
  from: Date,
  officialIds: readonly string[],
): Promise<{ rows: Thread[]; truncated: boolean }> {
  const match: Document = {
    firstMessageAt: { $gte: from },
    participants: { $nin: [...officialIds] },
  }

  const conversations = await db
    .collection<ThreadRow>(COLLECTIONS.conversations)
    .find(match, { projection: { participants: 1, firstMessageAt: 1, bothSpoke: 1 } })
    .sort({ firstMessageAt: -1 })
    .limit(THREAD_CAP + 1)
    .toArray()
  const kept = conversations.slice(0, THREAD_CAP)

  const replies = await db
    .collection<ThreadRow>(COLLECTIONS.conversations)
    .aggregate<{ _id: unknown; firstReplyAt?: Date }>([
      { $match: { ...match, bothSpoke: true } },
      { $sort: { firstMessageAt: -1 } },
      { $limit: THREAD_CAP },
      {
        $lookup: {
          from: COLLECTIONS.messages,
          let: { thread: '$_id', opener: '$firstMessageBy' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$conversationId', '$$thread'] },
                    { $ne: ['$senderId', '$$opener'] },
                    { $ne: ['$type', 'call'] },
                  ],
                },
              },
            },
            { $sort: { createdAt: 1 } },
            { $limit: 1 },
            { $project: { _id: 0, createdAt: 1 } },
          ],
          as: 'reply',
        },
      },
      { $project: { firstReplyAt: { $first: '$reply.createdAt' } } },
    ])
    .toArray()
  const replyAt = new Map(replies.map((row) => [String(row._id), row.firstReplyAt ?? null]))

  return {
    rows: kept.map((row) => ({
      participants: row.participants,
      firstMessageAt: row.firstMessageAt,
      firstReplyAt: replyAt.get(String(row._id)) ?? null,
    })),
    truncated: conversations.length > THREAD_CAP,
  }
}

/** Who was refused inside the window, and which limits. */
async function readRefusalRows(db: Db, now: Date): Promise<RefusalRow[]> {
  const since = new Date(now.getTime() - QUOTA_REFUSAL_WINDOW_MS)
  const rows = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .aggregate<RefusalRow>([
      { $match: { quotaRefusals: { $gte: since } } },
      { $limit: REFUSAL_PROFILE_CAP },
      {
        $project: {
          _id: 0,
          total: {
            $size: { $filter: { input: '$quotaRefusals', cond: { $gte: ['$$this', since] } } },
          },
          kinds: {
            $map: {
              input: {
                $filter: {
                  input: { $ifNull: ['$quotaRefusalKinds', []] },
                  cond: { $gte: ['$$this.at', since] },
                },
              },
              as: 'entry',
              in: '$$entry.kind',
            },
          },
        },
      },
    ])
    .toArray()
  return rows
}
