import {
  CEFR_LEVELS,
  cefrRank,
  DISCOVERY_PRO_FILTER_KEYS,
  ERROR_CODES,
  hasFeature,
  ONLINE_WINDOW_MS,
  type CefrLevel,
  type DiscoveryItem,
  type DiscoveryPage,
  type DiscoveryQuery,
} from '@langx/shared'
import type { Db, Document } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { blockedUserIds } from '../moderation/blocks'
import { ApiError } from '../../lib/ApiError'
import { effectiveTier } from '../profiles/entitlement'
import type { Profile } from '../profiles/profiles'

/**
 * `active`'s cursor is a real keyset token over the same field the discovery
 * indexes sort by (`stats.lastActiveAt`), so pagination stays index-driven
 * for as many pages as a user scrolls. `recommended`'s score is computed
 * per-request from the viewer's own profile — nothing to build a compound
 * index on — so it's offset pagination instead, page-capped rather than
 * cursor-safe. That tradeoff is deliberate for MVP scale; revisit only if
 * discovery becomes the actual bottleneck.
 */
function encodeActiveCursor(lastActiveAt: Date, id: string): string {
  return `${lastActiveAt.toISOString()}|${id}`
}

function decodeActiveCursor(cursor: string): { lastActiveAt: Date; id: string } {
  const [iso, id] = cursor.split('|')
  const lastActiveAt = iso ? new Date(iso) : null
  if (!lastActiveAt || Number.isNaN(lastActiveAt.getTime()) || !id) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Malformed cursor')
  }
  return { lastActiveAt, id }
}

function decodeOffsetCursor(cursor: string): number {
  const offset = Number.parseInt(cursor, 10)
  if (!Number.isInteger(offset) || offset < 0) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Malformed cursor')
  }
  return offset
}

/** Levels at or above `minLevel`, e.g. B1 → ['B1','B2','C1','C2']. */
function levelsAtOrAbove(minLevel: CefrLevel): CefrLevel[] {
  return CEFR_LEVELS.slice(cefrRank(minLevel) - 1)
}

export async function discoverProfiles(
  db: Db,
  viewerId: string,
  query: DiscoveryQuery,
): Promise<DiscoveryPage> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const viewer = await profiles.findOne({ _id: viewerId })
  if (!viewer) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')

  const proKeysUsed = DISCOVERY_PRO_FILTER_KEYS.filter((key) => query[key] !== undefined)
  if (proKeysUsed.length > 0 && !hasFeature(effectiveTier(viewer), 'advancedFilters')) {
    throw new ApiError(ERROR_CODES.UPGRADE_REQUIRED, 'Advanced filters require Pro', {
      feature: 'advancedFilters',
    })
  }

  const myNativeCodes = viewer.nativeLanguages.map((l) => l.code)
  const myLearningCodes = viewer.learning.map((l) => l.code)

  if (query.targetLanguage && !myLearningCodes.includes(query.targetLanguage)) {
    throw new ApiError(
      ERROR_CODES.VALIDATION_FAILED,
      'targetLanguage must be one of your own learning languages',
    )
  }
  // Their native language must be something I'm learning — narrowed to one
  // language if the caller asked for a specific target, otherwise any of mine.
  const wantTheirNative = query.targetLanguage ? [query.targetLanguage] : myLearningCodes

  // One helper for "everyone I must not see", shared with the conversation
  // list, the leaderboard and profile views — see `blockedUserIds`.
  const excludedIds = [viewerId, ...(await blockedUserIds(db, viewerId))]

  const match: Document = {
    _id: { $nin: excludedIds },
    'settings.discoverable': true,
    deletedAt: { $exists: false },
    // Mutual fit, both directions — the reason for the two split indexes.
    'nativeLanguages.code': { $in: wantTheirNative },
    'learning.code': { $in: myNativeCodes },
  }

  if (query.online) {
    match['stats.lastActiveAt'] = { $gte: new Date(Date.now() - ONLINE_WINDOW_MS) }
  }
  if (query.gender) match.gender = query.gender
  // "Match my gender", resolved here because here is where the viewer's own
  // gender is known for certain. Deliberately silent when the viewer has not
  // disclosed one: matching everybody else who also declined is not what the
  // toggle means, and narrowing to that group would be a worse answer than
  // not narrowing at all.
  if (query.onlyMyGender && viewer.gender !== 'undisclosed') match.gender = viewer.gender
  if (query.country) match.country = query.country
  if (query.minLevel) {
    // How well *they* speak *my* native language — the language they're
    // learning from me, not the one I'm learning from them (native speakers
    // have no CEFR level to filter on).
    match.learning = {
      $elemMatch: { code: { $in: myNativeCodes }, level: { $in: levelsAtOrAbove(query.minLevel) } },
    }
  }
  if (query.ageMin !== undefined || query.ageMax !== undefined) {
    const currentYear = new Date().getUTCFullYear()
    const birthYear: Document = {}
    // Older age → smaller birth year, so ageMin caps birthYear from above.
    if (query.ageMin !== undefined) birthYear.$lte = currentYear - query.ageMin
    if (query.ageMax !== undefined) birthYear.$gte = currentYear - query.ageMax
    match.birthYear = birthYear
  }

  const pipeline: Document[] = [{ $match: match }]

  if (query.sort === 'active') {
    if (query.cursor) {
      const { lastActiveAt, id } = decodeActiveCursor(query.cursor)
      pipeline.push({
        $match: {
          $or: [
            { 'stats.lastActiveAt': { $lt: lastActiveAt } },
            { 'stats.lastActiveAt': lastActiveAt, _id: { $gt: id } },
          ],
        },
      })
    }
    pipeline.push({ $sort: { 'stats.lastActiveAt': -1, _id: 1 } })
  } else {
    // Small, capped arrays (MAX_LANGUAGES=5, MAX_INTERESTS=10) — cheap to
    // score with $setIntersection per candidate rather than needing a
    // separate scoring pass.
    pipeline.push(
      {
        $addFields: {
          score: {
            $add: [
              { $size: { $setIntersection: ['$learning.code', myNativeCodes] } },
              { $size: { $setIntersection: ['$nativeLanguages.code', myLearningCodes] } },
              {
                $multiply: [0.5, { $size: { $setIntersection: ['$interests', viewer.interests] } }],
              },
            ],
          },
        },
      },
      { $sort: { score: -1, 'stats.lastActiveAt': -1, _id: 1 } },
    )
    if (query.cursor) pipeline.push({ $skip: decodeOffsetCursor(query.cursor) })
  }

  // Fetch one extra to know whether a next page exists without a second round-trip.
  pipeline.push({ $limit: query.limit + 1 })

  const docs = await profiles.aggregate<Profile & { score?: number }>(pipeline).toArray()
  const hasMore = docs.length > query.limit
  const page = hasMore ? docs.slice(0, query.limit) : docs

  const now = new Date()
  const items: DiscoveryItem[] = page.map((doc) => {
    const item: DiscoveryItem = {
      _id: doc._id,
      handle: doc.handle,
      displayName: doc.displayName,
      gender: doc.gender,
      age: now.getUTCFullYear() - doc.birthYear,
      // Stored values were already validated against languageCodeSchema/cefrLevelSchema
      // at write time (createProfile/updateProfile) — Profile's own DB-facing
      // interface just doesn't carry those branded types.
      nativeLanguages: doc.nativeLanguages as DiscoveryItem['nativeLanguages'],
      learning: doc.learning as DiscoveryItem['learning'],
      isOnline: now.getTime() - new Date(doc.stats.lastActiveAt).getTime() < ONLINE_WINDOW_MS,
      streak: { current: doc.streak.current },
    }
    if (doc.avatarUrl !== undefined) item.avatarUrl = doc.avatarUrl
    if (doc.bio !== undefined) item.bio = doc.bio
    if (doc.country !== undefined) item.country = doc.country
    return item
  })

  let nextCursor: string | null = null
  if (hasMore) {
    const last = page.at(-1)
    if (last) {
      nextCursor =
        query.sort === 'active'
          ? encodeActiveCursor(new Date(last.stats.lastActiveAt), last._id)
          : String(page.length + decodeOffsetCursorSafe(query.cursor))
    }
  }

  return { items, nextCursor }
}

function decodeOffsetCursorSafe(cursor: string | undefined): number {
  return cursor ? decodeOffsetCursor(cursor) : 0
}
