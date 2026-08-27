import { ERROR_CODES, hasFeature } from '@langx/shared'
import { type ObjectId, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
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
export async function getViewers(db: Db, userId: string): Promise<ViewerSummary> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const me = await profiles.findOne({ _id: userId })
  if (!me) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')

  const hidden = await blockedUserIds(db, userId)
  const filter = { viewedId: userId, viewerId: { $nin: hidden } }

  const total = await db.collection<ProfileView>(COLLECTIONS.profileViews).countDocuments(filter)

  if (!hasFeature(effectiveTier(me), 'profileViewerIdentities')) {
    return { total, viewers: [], locked: true }
  }

  const views = await db
    .collection<ProfileView>(COLLECTIONS.profileViews)
    .find(filter)
    .sort({ lastViewedAt: -1 })
    .limit(100)
    .toArray()

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

  return { total, viewers, locked: false }
}
