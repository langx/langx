import {
  ERROR_CODES,
  MODERATION_PAGE_SIZE_DEFAULT,
  hasFeature,
  utcDayKey,
  type ModerationListQuery,
} from '@langx/shared'
import { type Db, type Filter, type ObjectId } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { decodeDateIdCursor, encodeDateIdCursor } from '../../lib/dateIdCursor'
import { effectiveTier } from '../profiles/entitlement'
import type { Profile } from '../profiles/profiles'
import { blockedUserIds } from './blocks'

/**
 * One row per viewer, per profile, per UTC day.
 *
 * It was one row per pair for life, with `count` climbing forever — "xue
 * 43×" on the list, which said nothing about *when*. A day is the unit a
 * person thinks in ("who looked yesterday"), so it is the unit stored.
 * `day` is optional only because rows written before it existed lack it;
 * `scripts/migrate-profile-views.ts` backfills, and every reader tolerates
 * its absence in the meantime.
 */
export interface ProfileView {
  _id: ObjectId
  viewerId: string
  viewedId: string
  /** `YYYY-MM-DD`, UTC. Absent on rows from before the day split. */
  day?: string
  firstViewedAt: Date
  lastViewedAt: Date
  /** Visits that day, where a visit is a burst of views closer than `SESSION_GAP_MS`. */
  count: number
}

/**
 * Two views closer than this are one visit. Somebody who opens a profile,
 * goes to the photos, and comes back has looked once, not three times; the
 * counter on the list should say what a person would say.
 */
export const SESSION_GAP_MS = 10 * 60 * 1000

/** How many days the chart on `/viewers` draws, ending today. */
export const VIEWS_WEEK_DAYS = 7

export interface ViewerSummary {
  /** Distinct people, not rows: the number the free tier is shown. */
  total: number
  /**
   * The rows themselves are returned either way; what a locked row omits is
   * **who**.
   *
   * A locked row carries the real timestamp and the real repeat count — facts
   * about the reader's own profile, which they are entitled to — but no
   * `handle` and no `displayName`, and an `avatarUrl` that is a shape rather
   * than a face. The client blurs them, and blurring is all it does: sending
   * the real identities and relying on the client to obscure them would put
   * the whole paid feature in the response body for anyone who reads the JSON.
   */
  viewers: {
    userId: string
    /** The UTC day this row is about. */
    day: string
    /** Absent while `locked` — it is the identity. */
    handle?: string
    /** Absent while `locked`. */
    displayName?: string
    avatarUrl?: string
    /**
     * Somebody browsing without an account. Never a handle, never a name —
     * there is none — and the client must not draw the "withheld" bar for it,
     * because nothing was withheld.
     */
    guest?: true
    lastViewedAt: string
    /** Visits that day. Always at least 1. */
    viewCount: number
  }[]
  locked: boolean
  /**
   * Visits per day for the last `VIEWS_WEEK_DAYS` days, oldest first, ending
   * today. Only on the first page — it describes the whole list, not the
   * page — and free for everyone: it is a count, and counts were never the
   * paid part.
   */
  week?: { day: string; visits: number }[]
  /** `null` on the last page. */
  nextCursor: string | null
}

/**
 * Records that `viewerId` looked at `viewedId`, unless the viewer is browsing
 * incognito.
 *
 * Incognito is checked here rather than at the route because "don't leave a
 * trace" has to hold for every path that can reach a profile — a deep link, a
 * conversation header, discovery.
 *
 * Two writes rather than one upsert, because the counter must not move on
 * every request. The first matches today's row only if its last view is
 * older than the session gap, and bumps the count; if nothing matched, the
 * second either creates today's row or — the row exists and the gap has not
 * passed — just moves `lastViewedAt`. `$setOnInsert` carries the count, so
 * the second write can never increment.
 */
export async function recordProfileView(
  db: Db,
  viewer: Profile,
  viewedId: string,
  now = new Date(),
): Promise<'recorded' | 'incognito' | 'self'> {
  if (viewer._id === viewedId) return 'self'
  // Incognito is a Pro capability; an expired subscription loses it silently
  // rather than keeping a Pro-only privacy setting alive forever.
  if (viewer.privacy.incognito && hasFeature(effectiveTier(viewer), 'incognito')) {
    return 'incognito'
  }

  const views = db.collection<ProfileView>(COLLECTIONS.profileViews)
  const day = utcDayKey(now)
  const key = { viewerId: viewer._id, viewedId, day }

  const bumped = await views.updateOne(
    { ...key, lastViewedAt: { $lt: new Date(now.getTime() - SESSION_GAP_MS) } },
    { $set: { lastViewedAt: now }, $inc: { count: 1 } },
  )
  if (bumped.matchedCount === 0) {
    await views.updateOne(
      key,
      { $set: { lastViewedAt: now }, $setOnInsert: { ...key, firstViewedAt: now, count: 1 } },
      { upsert: true },
    )
  }
  return 'recorded'
}

/** The view's day, for rows written before the column existed. */
function dayOf(view: ProfileView): string {
  return view.day ?? utcDayKey(view.lastViewedAt)
}

/**
 * How many people looked, in a window, and who — if this account may know.
 *
 * The tier gate and the block filter both live here rather than in the
 * notification pass, so the free/Pro line is drawn in exactly one module.
 *
 * `viewers` is `null`, not empty, when the identities are locked: a
 * notification that named somebody to a free user would hand out the thing
 * the paywall is arguing about, and an empty array would read as "nobody".
 * Guests are counted but never named: there is no name to give.
 */
export async function viewSummarySince(
  db: Db,
  userId: string,
  since: Date,
  limit = 5,
): Promise<{ count: number; viewers: { displayName: string }[] | null } | null> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const me = await profiles.findOne({ _id: userId })
  if (!me) return null

  const hidden = await blockedUserIds(db, userId)
  const filter: Filter<ProfileView> = {
    viewedId: userId,
    lastViewedAt: { $gte: since },
    viewerId: { $nin: hidden },
  }
  // People, not rows: with a row per day, one visitor over three days is
  // three rows and one person.
  const people = await db
    .collection<ProfileView>(COLLECTIONS.profileViews)
    .distinct('viewerId', filter)
  const count = people.length
  if (count === 0) return { count: 0, viewers: null }
  if (!hasFeature(effectiveTier(me), 'profileViewerIdentities')) return { count, viewers: null }

  const recent = await db
    .collection<ProfileView>(COLLECTIONS.profileViews)
    .find(filter)
    .sort({ lastViewedAt: -1, _id: -1 })
    .limit(limit * VIEWS_WEEK_DAYS)
    .toArray()
  const viewerProfiles = await profiles
    .find(
      { _id: { $in: recent.map((view) => view.viewerId) }, deletedAt: { $exists: false } },
      { projection: { handle: 1, displayName: 1, guest: 1 } },
    )
    .toArray()
  const byId = new Map(viewerProfiles.map((p) => [p._id, p]))

  const viewers: { displayName: string }[] = []
  const named = new Set<string>()
  for (const view of recent) {
    if (viewers.length >= limit) break
    if (named.has(view.viewerId)) continue
    const profile = byId.get(view.viewerId)
    if (!profile || profile.guest) continue
    named.add(view.viewerId)
    viewers.push({ displayName: profile.displayName || profile.handle })
  }
  return { count, viewers }
}

/**
 * Visits per day over the last week, for the chart above the list.
 *
 * Grouped by the stored `day`, falling back to the timestamp's day for rows
 * from before the column — so the chart is right on the morning the migration
 * runs, not a week later.
 */
async function visitsByDay(
  db: Db,
  viewedId: string,
  hidden: string[],
  now: Date,
): Promise<{ day: string; visits: number }[]> {
  const days: string[] = []
  for (let back = VIEWS_WEEK_DAYS - 1; back >= 0; back--) {
    days.push(utcDayKey(new Date(now.getTime() - back * 24 * 60 * 60 * 1000)))
  }
  const from = new Date(`${days[0]}T00:00:00Z`)

  const rows = await db
    .collection<ProfileView>(COLLECTIONS.profileViews)
    .aggregate<{ _id: string; visits: number }>([
      { $match: { viewedId, viewerId: { $nin: hidden }, lastViewedAt: { $gte: from } } },
      {
        $project: {
          count: { $ifNull: ['$count', 1] },
          day: {
            $ifNull: [
              '$day',
              { $dateToString: { format: '%Y-%m-%d', date: '$lastViewedAt', timezone: 'UTC' } },
            ],
          },
        },
      },
      { $group: { _id: '$day', visits: { $sum: '$count' } } },
    ])
    .toArray()
  const byDay = new Map(rows.map((row) => [row._id, row.visits]))
  return days.map((day) => ({ day, visits: byDay.get(day) ?? 0 }))
}

/**
 * "Who viewed me". The count is free; the identities are the Pro hook.
 *
 * Returning `locked: true` with a real total rather than a 403 is deliberate —
 * the paywall is only persuasive if the user can see there is something behind
 * it.
 */
export async function getViewers(
  db: Db,
  userId: string,
  query: ModerationListQuery = { limit: MODERATION_PAGE_SIZE_DEFAULT },
  now = new Date(),
): Promise<ViewerSummary> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const me = await profiles.findOne({ _id: userId })
  if (!me) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')

  const hidden = await blockedUserIds(db, userId)
  const filter: Filter<ProfileView> = { viewedId: userId, viewerId: { $nin: hidden } }

  // The count is over everyone, not over the page — it is the number the free
  // tier is shown, and the thing the paywall is arguing about. People, not
  // rows, now that one person over three days is three rows.
  const total = (
    await db.collection<ProfileView>(COLLECTIONS.profileViews).distinct('viewerId', filter)
  ).length

  const locked = !hasFeature(effectiveTier(me), 'profileViewerIdentities')

  const paged: Filter<ProfileView> = { ...filter }
  if (query.cursor) {
    const { date, id } = decodeDateIdCursor(query.cursor)
    paged.$or = [{ lastViewedAt: { $lt: date } }, { lastViewedAt: date, _id: { $lt: id } }]
  }

  // Was a hard `.limit(100)` with no way past it: someone with 150 viewers saw
  // 100 of them beside a `total` saying 150, which reads as the feature being
  // broken rather than paged.
  const page = await db
    .collection<ProfileView>(COLLECTIONS.profileViews)
    .find(paged)
    .sort({ lastViewedAt: -1, _id: -1 })
    .limit(query.limit + 1)
    .toArray()

  const hasMore = page.length > query.limit
  const views = hasMore ? page.slice(0, query.limit) : page
  const lastView = views.at(-1)

  /*
   * Not read at all while locked. The projection is narrow, but the surest way
   * for an identity not to reach a free account is for the query that would
   * have found it never to run.
   */
  const byId = locked
    ? new Map<string, Pick<Profile, '_id' | 'handle' | 'displayName' | 'avatarUrl' | 'guest'>>()
    : new Map(
        (
          await profiles
            .find(
              { _id: { $in: views.map((v) => v.viewerId) }, deletedAt: { $exists: false } },
              { projection: { handle: 1, displayName: 1, avatarUrl: 1, guest: 1 } },
            )
            .toArray()
        ).map((p) => [p._id, p]),
      )

  const viewers: ViewerSummary['viewers'] = []
  for (const view of views) {
    /*
     * A locked row keeps its place in the list. It is the shape of the list —
     * how many people, how recently, who came back — that the paywall is
     * arguing about, and an empty list argues nothing.
     */
    if (locked) {
      viewers.push({
        userId: view.viewerId,
        day: dayOf(view),
        lastViewedAt: view.lastViewedAt.toISOString(),
        // `?? 1` for the rows written before the counter existed: a view
        // that was recorded is at least one view.
        viewCount: view.count ?? 1,
      })
      continue
    }
    const profile = byId.get(view.viewerId)
    if (!profile) continue
    if (profile.guest) {
      viewers.push({
        userId: view.viewerId,
        day: dayOf(view),
        guest: true,
        lastViewedAt: view.lastViewedAt.toISOString(),
        viewCount: view.count ?? 1,
      })
      continue
    }
    const entry: ViewerSummary['viewers'][number] = {
      userId: view.viewerId,
      day: dayOf(view),
      handle: profile.handle,
      // `||`, not `??`: a stored empty string is "no name", and the handle is
      // always a better answer than nothing.
      displayName: profile.displayName || profile.handle,
      lastViewedAt: view.lastViewedAt.toISOString(),
      viewCount: view.count ?? 1,
    }
    if (profile.avatarUrl !== undefined) entry.avatarUrl = profile.avatarUrl
    viewers.push(entry)
  }

  const summary: ViewerSummary = {
    total,
    viewers,
    locked,
    // Off the raw page, not off `viewers`: a view whose profile was deleted is
    // dropped from the output but still consumed a place in the page, and
    // cursoring from the last *rendered* row would replay it.
    nextCursor:
      hasMore && lastView ? encodeDateIdCursor(lastView.lastViewedAt, lastView._id) : null,
  }
  if (!query.cursor) summary.week = await visitsByDay(db, userId, hidden, now)
  return summary
}
