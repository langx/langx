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
  /** Populated only for Pro — free tier gets the count and a paywall. */
  viewers: {
    userId: string
    handle: string
    displayName: string
    avatarUrl?: string
    lastViewedAt: string
  }[]
  locked: boolean
  /** `null` on the last page, and always `null` while `locked`. */
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

  if (!hasFeature(effectiveTier(me), 'profileViewerIdentities')) {
    return { total, viewers: [], locked: true, nextCursor: null }
  }

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

  const viewerProfiles = await profiles
    .find(
      { _id: { $in: views.map((v) => v.viewerId) }, deletedAt: { $exists: false } },
      { projection: { handle: 1, displayName: 1, avatarUrl: 1 } },
    )
    .toArray()
  const byId = new Map(viewerProfiles.map((p) => [p._id, p]))

  const viewers: ViewerSummary['viewers'] = []
  for (const view of views) {
    const profile = byId.get(view.viewerId)
    if (!profile) continue
    const entry: ViewerSummary['viewers'][number] = {
      userId: view.viewerId,
      handle: profile.handle,
      displayName: profile.displayName ?? profile.handle,
      lastViewedAt: view.lastViewedAt.toISOString(),
    }
    if (profile.avatarUrl !== undefined) entry.avatarUrl = profile.avatarUrl
    viewers.push(entry)
  }

  return {
    total,
    viewers,
    locked: false,
    // Off the raw page, not off `viewers`: a view whose profile was deleted is
    // dropped from the output but still consumed a place in the page, and
    // cursoring from the last *rendered* row would replay it.
    nextCursor:
      hasMore && lastView ? encodeDateIdCursor(lastView.lastViewedAt, lastView._id) : null,
  }
}
