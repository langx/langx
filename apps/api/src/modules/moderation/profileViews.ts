import {
  ERROR_CODES,
  MODERATION_PAGE_SIZE_DEFAULT,
  hasFeature,
  type ModerationListQuery,
} from '@langx/shared'
import { type Db, type Filter, type ObjectId } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { decodeDateIdCursor, encodeDateIdCursor } from '../../lib/dateIdCursor'
import { effectiveTier } from '../profiles/entitlement'
import type { Profile } from '../profiles/profiles'
import { blockedUserIds } from './blocks'

export interface ProfileView {
  _id: ObjectId
  viewerId: string
  viewedId: string
  firstViewedAt: Date
  lastViewedAt: Date
  count: number
}

export interface ViewerSummary {
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
    /** Absent while `locked` — it is the identity. */
    handle?: string
    /** Absent while `locked`. */
    displayName?: string
    avatarUrl?: string
    lastViewedAt: string
    /** How many times this person has been back. Always at least 1. */
    viewCount: number
  }[]
  locked: boolean
  /** `null` on the last page. */
  nextCursor: string | null
}

/**
 * Records that `viewerId` looked at `viewedId`, unless the viewer is browsing
 * incognito.
 *
 * Incognito is checked here rather than at the route because "don't leave a
 * trace" has to hold for every path that can reach a profile — a deep link, a
 * conversation header, discovery. One upsert per pair (see
 * `viewer_viewed_unique`), so a stalker refreshing forty times is one row with
 * a count, not forty rows.
 */
export async function recordProfileView(
  db: Db,
  viewer: Profile,
  viewedId: string,
): Promise<'recorded' | 'incognito' | 'self'> {
  if (viewer._id === viewedId) return 'self'
  // Incognito is a Pro capability; an expired subscription loses it silently
  // rather than keeping a Pro-only privacy setting alive forever.
  if (viewer.privacy.incognito && hasFeature(effectiveTier(viewer), 'incognito')) {
    return 'incognito'
  }

  const now = new Date()
  await db.collection<ProfileView>(COLLECTIONS.profileViews).updateOne(
    { viewerId: viewer._id, viewedId },
    {
      $set: { lastViewedAt: now },
      $inc: { count: 1 },
      $setOnInsert: { viewerId: viewer._id, viewedId, firstViewedAt: now },
    },
    { upsert: true },
  )
  return 'recorded'
}

/**
 * How many people looked, in a window, and who — if this account may know.
 *
 * The tier gate and the block filter both live here rather than in the
 * notification pass, so the free/Pro line is drawn in exactly one module.
 * `viewers` is `null`, not empty, when the identities are locked: a
 * notification that named somebody to a free user would hand out the thing
 * the paywall is arguing about, and an empty array would read as "nobody".
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
  const count = await db.collection<ProfileView>(COLLECTIONS.profileViews).countDocuments(filter)
  if (count === 0) return { count: 0, viewers: null }
  if (!hasFeature(effectiveTier(me), 'profileViewerIdentities')) return { count, viewers: null }

  const recent = await db
    .collection<ProfileView>(COLLECTIONS.profileViews)
    .find(filter)
    .sort({ lastViewedAt: -1, _id: -1 })
    .limit(limit)
    .toArray()
  const viewerProfiles = await profiles
    .find(
      { _id: { $in: recent.map((view) => view.viewerId) }, deletedAt: { $exists: false } },
      { projection: { handle: 1, displayName: 1 } },
    )
    .toArray()
  const byId = new Map(viewerProfiles.map((p) => [p._id, p]))

  const viewers: { displayName: string }[] = []
  for (const view of recent) {
    const profile = byId.get(view.viewerId)
    if (profile) viewers.push({ displayName: profile.displayName ?? profile.handle })
  }
  return { count, viewers }
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
): Promise<ViewerSummary> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const me = await profiles.findOne({ _id: userId })
  if (!me) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')

  const hidden = await blockedUserIds(db, userId)
  const filter: Filter<ProfileView> = { viewedId: userId, viewerId: { $nin: hidden } }

  // The count is over everyone, not over the page — it is the number the free
  // tier is shown, and the thing the paywall is arguing about.
  const total = await db.collection<ProfileView>(COLLECTIONS.profileViews).countDocuments(filter)

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
    ? new Map<string, Pick<Profile, '_id' | 'handle' | 'displayName' | 'avatarUrl'>>()
    : new Map(
        (
          await profiles
            .find(
              { _id: { $in: views.map((v) => v.viewerId) }, deletedAt: { $exists: false } },
              { projection: { handle: 1, displayName: 1, avatarUrl: 1 } },
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
        lastViewedAt: view.lastViewedAt.toISOString(),
        // `?? 1` for the rows written before the counter existed: a view
        // that was recorded is at least one view.
        viewCount: view.count ?? 1,
      })
      continue
    }
    const profile = byId.get(view.viewerId)
    if (!profile) continue
    const entry: ViewerSummary['viewers'][number] = {
      userId: view.viewerId,
      handle: profile.handle,
      displayName: profile.displayName ?? profile.handle,
      lastViewedAt: view.lastViewedAt.toISOString(),
      viewCount: view.count ?? 1,
    }
    if (profile.avatarUrl !== undefined) entry.avatarUrl = profile.avatarUrl
    viewers.push(entry)
  }

  return {
    total,
    viewers,
    locked,
    // Off the raw page, not off `viewers`: a view whose profile was deleted is
    // dropped from the output but still consumed a place in the page, and
    // cursoring from the last *rendered* row would replay it.
    nextCursor:
      hasMore && lastView ? encodeDateIdCursor(lastView.lastViewedAt, lastView._id) : null,
  }
}
