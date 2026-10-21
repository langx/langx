import {
  adultBornOnOrBefore,
  ageFromBirthDate,
  isAdult,
  LANGUAGE_LEVELS,
  levelRank,
  bucketDistanceKm,
  DISCOVERY_BOOSTED_CANDIDATE_MAX,
  DISCOVERY_BOOSTED_LIMIT,
  DISCOVERY_DORMANT_DAYS,
  DISCOVERY_NEW_DAYS,
  DISCOVERY_NEW_LIMIT,
  DISCOVERY_REPLY_SIGNAL_MIN_RATE,
  DISCOVERY_REPLY_SIGNAL_MIN_SAMPLE,
  DISCOVERY_RESPONSIVENESS_WEIGHT,
  STORED_PLAN_TIERS,
  normalizePlanTier,
  PLAN_LIMITS,
  DISCOVERY_CROSS_MATCH_FALLBACK,
  DISCOVERY_PRO_FILTER_KEYS,
  ERROR_CODES,
  hasFeature,
  DISCOVERY_CURSOR_MAX_AGE_MS,
  ONLINE_WINDOW_MS,
  isOnlineAt,
  wornFrameTone,
  type LanguageLevel,
  type BoostedProfile,
  type BoostedProfilesPage,
  type DiscoveryItem,
  type DiscoveryPage,
  type DiscoveryQuery,
  type NewProfilesPage,
  type PlanTier,
} from '@langx/shared'
import type { Db, Document } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { getAppConfig } from '../appConfig/appConfig'
import type { Conversation } from '../chat/conversations'
import { blockedUserIds } from '../moderation/blocks'
import { notSuspended } from '../moderation/suspension'
import { hidesOnlineStatus } from '../profiles/presenceVisibility'
import { defaultAvatarRevFor } from '../profiles/defaultAvatar'
import { ApiError } from '../../lib/ApiError'
import { effectiveTier } from '../profiles/entitlement'
import type { Profile } from '../profiles/profiles'
import { orderBoosted } from './boostedOrder'

/**
 * `active`'s cursor is a real keyset token over the same field the discovery
 * indexes sort by (`stats.lastActiveAt`), so pagination stays index-driven
 * for as many pages as a user scrolls. `recommended`'s score is computed
 * per-request from the viewer's own profile — nothing to build a compound
 * index on — so it's offset pagination instead, page-capped rather than
 * cursor-safe. That tradeoff is deliberate for MVP scale; revisit only if
 * discovery becomes the actual bottleneck.
 *
 * `nearby` shares `recommended`'s offset cursor, and there the reason is not a
 * tradeoff but a correctness one. A keyset over distance looks obvious —
 * `$geoNear` even offers `minDistance` for it — but stored coordinates are
 * rounded onto a ~1 km grid, so every profile in the same cell is at *exactly*
 * the same distance. Ties are the normal case rather than the rare one, and a
 * keyset that resumes after a tied value either repeats a whole cell or skips
 * one; resuming *at* it never terminates.
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

/**
 * `<cutoffISO>|<offset>` — the offset cursor, plus the moment "online" was
 * decided.
 *
 * The cutoff is a boundary *in time* that the offset is measured against.
 * Recompute it per request and someone crossing the five-minute line
 * mid-scroll moves the whole partition underneath a `$skip` that has already
 * been handed out: one profile repeats and another is never shown. Pinning it
 * at page one means the list reflects who was online when the scroll began,
 * which is also the honest answer to the question the chip asked.
 */
function encodeOnlineOffsetCursor(cutoff: Date, offset: number): string {
  return `${cutoff.toISOString()}|${offset}`
}

interface OnlineOffsetCursor {
  cutoff: Date
  offset: number
}

function decodeOnlineOffsetCursor(cursor: string, now: Date): OnlineOffsetCursor {
  // No separator means a cursor from a build before this existed. Reading it
  // as a bare offset keeps app versions already in the wild paging.
  if (!cursor.includes('|')) {
    return {
      cutoff: new Date(now.getTime() - ONLINE_WINDOW_MS),
      offset: decodeOffsetCursor(cursor),
    }
  }
  const [iso, rawOffset] = cursor.split('|')
  const cutoff = iso ? new Date(iso) : null
  if (!cutoff || Number.isNaN(cutoff.getTime()) || rawOffset === undefined) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Malformed cursor')
  }
  if (now.getTime() - cutoff.getTime() > DISCOVERY_CURSOR_MAX_AGE_MS) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Cursor has expired; start again')
  }
  return { cutoff, offset: decodeOffsetCursor(rawOffset) }
}

/**
 * Levels inside the inclusive band, either bound optional — `minLevel` alone
 * is "at or above", which is what pre-v3 clients still send.
 */
function levelsInBand(
  minLevel: LanguageLevel | undefined,
  maxLevel: LanguageLevel | undefined,
): LanguageLevel[] {
  const from = minLevel ? levelRank(minLevel) - 1 : 0
  const to = maxLevel ? levelRank(maxLevel) : LANGUAGE_LEVELS.length
  return LANGUAGE_LEVELS.slice(from, to)
}

/**
 * The viewer's own codes, narrowed to the ones the request named — or all of
 * them when it named none. A code the viewer does not have is a 400, not a
 * silent drop: a query composed by hand that asks for a language you are not
 * learning is a query composed wrong.
 */
function scopedTo(
  own: readonly string[],
  requested: readonly string[] | undefined,
  field: 'learningLanguages' | 'nativeLanguages',
  paused: ReadonlySet<string>,
): string[] {
  const active = own.filter((code) => !paused.has(code))
  if (!requested) return active
  const unknown = requested.filter((code) => !own.includes(code))
  if (unknown.length > 0) {
    throw new ApiError(
      ERROR_CODES.VALIDATION_FAILED,
      `${field} must be among your own languages (not: ${unknown.join(', ')})`,
    )
  }
  // A paused language is still the viewer's own — an app that lists every
  // language as a chip may name it — so it is dropped rather than refused.
  return requested.filter((code) => !paused.has(code))
}

/**
 * Candidates who list one of `codes` in `field`, counted only where that
 * language is not paused for them (`modules/profiles/languagePause.ts`).
 *
 * One clause per code rather than one `$in`, because the pause is per person
 * and per language: "lists French and French is not paused" is a pair of
 * conditions on the same code, which a single `$in` beside a `$nin` cannot
 * say. Each clause still leads with the indexed field, so the split indexes
 * serve every branch; a viewer has at most five codes a side. No codes at all
 * matches nobody, which is what the `$in: []` it replaces did.
 */
function unpausedFit(field: 'nativeLanguages' | 'learning', codes: readonly string[]): Document[] {
  return codes.map((code) => ({ [`${field}.code`]: code, pausedLanguages: { $ne: code } }))
}

const MATCHES_NOBODY: Document = { _id: { $in: [] } }

/** `$or` over clauses, or a match for nobody when there are none — `$or: []` is an error. */
function anyOf(clauses: Document[]): Document {
  return clauses.length > 0 ? { $or: clauses } : MATCHES_NOBODY
}

/**
 * Everything the discovery list and the boosted strip decide the same way:
 * who is asking, what their plan allows, and the `$match` that says whose
 * profile is eligible to be seen at all.
 *
 * Pulled out so the two cannot drift. Mutual language fit, blocks, the
 * discoverable/guest/deleted exclusions and every active filter are one
 * definition here, and a rule added to it reaches both callers. What stays
 * out is everything about *ordering* — the nearby entitlement, the location
 * requirement, sorts and cursors — because the strip has none of those.
 */
interface DiscoveryScope {
  viewer: Profile
  tier: PlanTier
  match: Document
  myNativeCodes: string[]
  myLearningCodes: string[]
}

/*
 * Exported for one reader beyond this file: the operator panel's "why is
 * Discover empty for this person" diagnosis, which has to evaluate the filter
 * the feature actually uses. A diagnosis built from a copy of these clauses
 * would answer confidently and be wrong the first time one of them changed.
 */
export async function resolveDiscoveryScope(
  db: Db,
  viewerId: string,
  query: DiscoveryQuery,
): Promise<DiscoveryScope> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const viewer = await profiles.findOne({ _id: viewerId })
  if (!viewer) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')

  const tier = effectiveTier(viewer)

  const proKeysUsed = DISCOVERY_PRO_FILTER_KEYS.filter((key) => query[key] !== undefined)
  if (proKeysUsed.length > 0 && !hasFeature(tier, 'advancedFilters')) {
    throw new ApiError(ERROR_CODES.UPGRADE_REQUIRED, 'Advanced filters require Pro', {
      feature: 'advancedFilters',
    })
  }

  // Which of the viewer's own languages this search is made with: all of them
  // unless the request narrowed a side, and a request can only narrow to
  // languages the viewer actually has. Their native must be something I'm
  // learning; their learning must be something I speak.
  //
  // A language of theirs that is paused — added during a gift that has ended
  // — is not searched with, the same way it is not searched for below.
  const paused = new Set(viewer.pausedLanguages ?? [])
  const myNativeCodes = scopedTo(
    viewer.nativeLanguages.map((l) => l.code),
    query.nativeLanguages,
    'nativeLanguages',
    paused,
  )
  const myLearningCodes = scopedTo(
    viewer.learning.map((l) => l.code),
    query.learningLanguages,
    'learningLanguages',
    paused,
  )
  const wantTheirNative = myLearningCodes

  // One helper for "everyone I must not see", shared with the conversation
  // list, the leaderboard and profile views — see `blockedUserIds`.
  const excludedIds = [viewerId, ...(await blockedUserIds(db, viewerId))]

  /**
   * Mutual fit, both directions — the reason for the two split indexes.
   *
   * `DISCOVERY_CROSS_MATCH_FALLBACK` turns the `and` into an `or` while the
   * app is small enough that the honest rule returns an empty screen; see the
   * note on that constant. It applies to the **default** search only. Naming
   * a language scope is asking a question about particular languages, and the
   * answer to that question is the strict one — which is also why this reads
   * `query`, not the resolved codes: those are the viewer's full set when the
   * request named nothing, and indistinguishable at this point from a request
   * that named all of them.
   */
  const namedLanguageScope =
    query.learningLanguages !== undefined || query.nativeLanguages !== undefined
  const theirNativeFits = unpausedFit('nativeLanguages', wantTheirNative)
  const theirLearningFits = unpausedFit('learning', myNativeCodes)
  // One flat `$or` for the fallback, and both sides for the strict rule. Each
  // side is an `$or` of its own now, so they sit in the match's `$and` rather
  // than as keys: two `$or` keys in one object would leave only the second.
  const languageFit: Document[] =
    DISCOVERY_CROSS_MATCH_FALLBACK && !namedLanguageScope
      ? [anyOf([...theirNativeFits, ...theirLearningFits])]
      : [anyOf(theirNativeFits), anyOf(theirLearningFits)]

  const match: Document = {
    _id: { $nin: excludedIds },
    'settings.discoverable': true,
    // Belt and braces. `discoverable: false` already excludes them, but a
    // guest surfacing in somebody's results is the single worst failure of
    // this feature, and one flag flipped by a future default should not be
    // all that stands between here and there.
    guest: { $exists: false },
    deletedAt: { $exists: false },
    // A suspended account is out of both the list and the strip. Their
    // profile still opens for somebody who has the link — see
    // `accountStatus` on `toPublicProfile` — but nothing proposes them.
    ...notSuspended(),
    $and: languageFit,
  }

  if (query.gender) match.gender = query.gender
  // "Match my gender", resolved here because here is where the viewer's own
  // gender is known for certain. Deliberately silent when the viewer has not
  // disclosed one: matching everybody else who also declined is not what the
  // toggle means, and narrowing to that group would be a worse answer than
  // not narrowing at all.
  if (query.onlyMyGender && viewer.gender !== 'undisclosed') match.gender = viewer.gender
  if (query.country) match.country = query.country
  /*
   * An id, matched exactly. Both ends of this comparison now come from the
   * same canonical list — the searcher picked one, and the profile's was
   * worked out from its coordinates — so there is nothing left to normalise.
   *
   * It answers only for people who share their location, since that is where
   * the city comes from. The filter screen says so; a filter that silently
   * excluded most of the app would read as broken.
   */
  if (query.cityId) match.cityId = query.cityId
  if (query.minLevel || query.maxLevel) {
    // How well *they* speak *my* native language — the language they're
    // learning from me, not the one I'm learning from them (native speakers
    // have no level to filter on).
    //
    // Per code, for `unpausedFit`'s reason: the level that counts is on a
    // language that is not paused for them. Under `$and` beside the fit, whose
    // own key it would otherwise share.
    const levels = levelsInBand(query.minLevel, query.maxLevel)
    const levelled = anyOf(
      myNativeCodes.map((code) => ({
        learning: { $elemMatch: { code, level: { $in: levels } } },
        pausedLanguages: { $ne: code },
      })),
    )
    match.$and = [...(match.$and as Document[]), levelled]
  }
  if (query.ageMin !== undefined || query.ageMax !== undefined) {
    const currentYear = new Date().getUTCFullYear()
    /**
     * Still a *year* range, now expressed over `YYYY-MM-DD` strings: the age
     * on a profile is the year difference (see `ageFromBirthDate`), and a
     * filter that used the exact age would hide people whose own profile says
     * they match. Lexicographic order on the string is calendar order, so a
     * plain range works — the January the 1st of the boundary year is the
     * cut.
     */
    const birthDate: Document = {}
    // Older age → earlier birth date, so ageMin caps the date from above.
    if (query.ageMin !== undefined) birthDate.$lt = `${currentYear - query.ageMin + 1}-01-01`
    if (query.ageMax !== undefined) birthDate.$gte = `${currentYear - query.ageMax}-01-01`
    match.birthDate = birthDate
  }

  return { viewer, tier, match, myNativeCodes, myLearningCodes }
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Everybody the viewer already has a thread with, whoever opened it.
 *
 * Rides `participants_recent`, projected to the pair. Reply-first discovery
 * leaves them out of the default list and the new strip: they are a tap away
 * in Chats, and a list that keeps proposing them spends its first rows on
 * people the viewer has already found.
 */
async function conversationPartnerIds(db: Db, viewerId: string): Promise<string[]> {
  const rows = await db
    .collection<Conversation>(COLLECTIONS.conversations)
    .find({ participants: viewerId }, { projection: { participants: 1 } })
    .toArray()
  return rows.flatMap((row) => row.participants.filter((id) => id !== viewerId))
}

/**
 * `(answered + 1) / (received + 2)` — how often somebody answers a first
 * message, with one imagined answered and one imagined unanswered added so a
 * stranger to the counters sits at one half rather than at zero or one.
 *
 * Absent counters read as zero, which is exactly the prior: every profile
 * written before the counters existed, and everybody nobody has written to
 * yet, scores what the whole list scored before this term was added.
 * `$min` because answered can only outgrow received if the two writes that
 * keep them were ever split by a failure, and a rate above one is not one.
 */
/**
 * A candidate's codes from one list, less the ones paused for them — so the
 * score counts the languages they are actually matched on.
 */
function unpausedCodes(codes: string): Document {
  return { $setDifference: [codes, { $ifNull: ['$pausedLanguages', []] }] }
}

const RESPONSIVENESS: Document = {
  $let: {
    vars: {
      received: { $ifNull: ['$stats.openersReceived', 0] },
      answered: { $ifNull: ['$stats.openersAnswered', 0] },
    },
    in: {
      $divide: [{ $add: [{ $min: ['$$answered', '$$received'] }, 1] }, { $add: ['$$received', 2] }],
    },
  },
}

/**
 * "Usually replies within a day", decided from the raw counters past a
 * minimum sample — no prior here: the line is a claim about a person, and it
 * should rest on what they did rather than on what everybody is assumed to.
 *
 * Off for somebody who hides their online status, for the reason
 * `hidesOnlineStatus` is read below: the line says when they are around.
 */
function repliesWithinDay(profile: Profile): boolean {
  if (hidesOnlineStatus(profile)) return false
  const received = profile.stats.openersReceived ?? 0
  if (received < DISCOVERY_REPLY_SIGNAL_MIN_SAMPLE) return false
  return (profile.stats.openersAnsweredWithinDay ?? 0) / received >= DISCOVERY_REPLY_SIGNAL_MIN_RATE
}

/**
 * The DTO every discovery surface returns. One mapping, so a field added to
 * the card is added once — the strip spreads its own `tier` on top and
 * changes nothing else.
 */
function toDiscoveryItem(
  doc: Profile & { distanceMeters?: number },
  now: Date,
  replyFirst: boolean,
): DiscoveryItem {
  const item: DiscoveryItem = {
    _id: doc._id,
    handle: doc.handle,
    displayName: doc.displayName,
    gender: doc.gender,
    age: ageFromBirthDate(doc.birthDate, now),
    // Stored values were already validated against languageCodeSchema/cefrLevelSchema
    // at write time (createProfile/updateProfile) — Profile's own DB-facing
    // interface just doesn't carry those branded types.
    nativeLanguages: doc.nativeLanguages as DiscoveryItem['nativeLanguages'],
    learning: doc.learning as DiscoveryItem['learning'],
    // Same rule as `toPublicProfile`, and it was missing here: a hidden
    // profile still drew a green dot in the discovery list, which is the
    // one place most people would have seen it.
    isOnline: hidesOnlineStatus(doc) ? false : isOnlineAt(doc.stats.lastActiveAt, now),
    streak: { current: doc.streak.current },
  }
  if (doc.avatarUrl !== undefined) item.avatarUrl = doc.avatarUrl
  const defaultAvatarRev = defaultAvatarRevFor(doc)
  if (defaultAvatarRev) item.defaultAvatarRev = defaultAvatarRev
  if (doc.bio !== undefined) item.bio = doc.bio
  if (doc.country !== undefined) item.country = doc.country
  // Bucketed, never the measured value — `bucketDistanceKm` explains what
  // reporting the real one would give away.
  if (doc.distanceMeters !== undefined) item.distanceKm = bucketDistanceKm(doc.distanceMeters)
  if (replyFirst && repliesWithinDay(doc)) item.repliesWithinDay = true
  /*
   * The worn frame's tone, resolved here as the leaderboards do, so a card
   * costs one short string rather than everything the person owns. Not behind
   * `incognito` or `hideOnlineStatus`: a frame says nothing about when anybody
   * is around, and `toPublicProfile` has always shown it to anyone who opens
   * the profile this card links to — the same exposure, one tap earlier.
   */
  const frame = wornFrameTone(doc.equipped, doc.cosmetics ?? [])
  if (frame) item.frame = frame
  return item
}

export async function discoverProfiles(
  db: Db,
  viewerId: string,
  query: DiscoveryQuery,
): Promise<DiscoveryPage> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const [{ viewer, tier, match, myNativeCodes, myLearningCodes }, config] = await Promise.all([
    resolveDiscoveryScope(db, viewerId, query),
    getAppConfig(db),
  ])
  /*
   * Reply-first applies to `recommended` only, for the reason online-first
   * does (below): `active` and `nearby` are questions the reader asked — who
   * is here, who is close — and somebody they already talk to is a true
   * answer to both. Off, nothing below differs from the pipeline before it.
   */
  const replyFirst = config.flags.discoveryReplyFirst
  const rankReplyFirst = replyFirst && query.sort === 'recommended'

  if (query.sort === 'nearby') {
    if (!hasFeature(tier, 'nearby')) {
      throw new ApiError(ERROR_CODES.UPGRADE_REQUIRED, 'Nearby requires Pro', {
        feature: 'nearby',
      })
    }
    // Checked before the query rather than left to return nothing: an empty
    // list would be indistinguishable from "nobody is near you", and the user
    // would go looking for people instead of for the setting.
    if (!viewer.location) {
      throw new ApiError(
        ERROR_CODES.LOCATION_REQUIRED,
        'Share your own location to sort by distance',
      )
    }
  }

  /**
   * `$geoNear` must be the pipeline's **first** stage — a MongoDB rule, not a
   * preference — which is what made a distance filter look impossible next to
   * a `$match` that is itself doing the mutual-language work
   * (`decisions.md`). The way out is that `$geoNear` takes the match as its
   * own `query` argument and applies it internally, so there is exactly one
   * leading stage and both conditions still hold.
   *
   * What is genuinely given up is which index drives the query: the 2dsphere
   * index selects candidates and the language arrays are filtered over that
   * already-narrowed set, rather than the other way round.
   *
   * `maxDistance` used to bound that set on every request and now appears only
   * when the searcher asked for a radius, which is the cost of the sort
   * meaning what it says. `$geoNear` walks the index outward until the page is
   * full, so a common language pair still stops within a few rings, while a
   * rare one can walk most of the index to find twenty people — and that is
   * exactly the search whose answer used to be a blank screen. Watch it if
   * discovery ever becomes the bottleneck; see `decisions.md`.
   */
  /*
   * `$and` rather than a second `_id` key, for the boosted strip's reason: the
   * scope already holds `_id: { $nin }` for the viewer and the blocks, and a
   * spread would replace it.
   */
  const partnerIds = rankReplyFirst ? await conversationPartnerIds(db, viewerId) : []
  const eligible: Document =
    partnerIds.length > 0 ? { $and: [match, { _id: { $nin: partnerIds } }] } : match

  const pipeline: Document[] =
    query.sort === 'nearby' && viewer.location
      ? [
          {
            $geoNear: {
              near: viewer.location,
              distanceField: 'distanceMeters',
              // Omitted entirely when no radius was asked for. `maxDistance:
              // undefined` would not do: the driver serialises the key and
              // MongoDB refuses a null bound.
              ...(query.radiusKm !== undefined ? { maxDistance: query.radiusKm * 1000 } : {}),
              // Named explicitly rather than left to MongoDB's single-geo-index
              // inference: a second geo index added later would otherwise turn
              // this into an error at runtime instead of at review.
              key: 'location',
              spherical: true,
              query: eligible,
            },
          },
        ]
      : [{ $match: eligible }]

  /**
   * "Online first" is an *ordering*, not a filter, and no longer a choice.
   *
   * It was a `$match` on the five-minute window once, which emptied the list
   * whenever nobody was about — the opposite of what a discovery screen is
   * for. Then it was a chip. Now it is simply how the recommended feed is
   * ordered: everyone still comes back, the online ones lead, and the rest
   * follow by score.
   *
   * It applies to `recommended` **only**, and the other two sorts are the
   * reason it is not global:
   *
   *   - `sort=active` orders by `lastActiveAt` descending, which already puts
   *     the five-minute window on top by construction. Adding the bucket in
   *     front would change nothing about the order and break the keyset cursor
   *     below, which compares `lastActiveAt` and `_id` and knows nothing about
   *     a bucket.
   *   - `sort=nearby` is bought to answer "who is near me". Bucketing first
   *     puts someone online 90 km away ahead of someone offline in the next
   *     street, which is not a nearby list with a preference — it is a
   *     recommended list with a radius.
   *
   * The cost is real and worth naming: `onlineBucket` is computed, so it can
   * never be indexed, and this is a blocking in-memory sort. It used to be
   * paid only by whoever turned the chip on; every default request pays it now.
   */
  const now = new Date()

  /*
   * Three sorts, three cursor shapes, and each is now decoded only by the sort
   * that writes it.
   *
   * That was a live bug: every cursor went through `decodeOnlineOffsetCursor`,
   * including `active`'s keyset `<iso>|<userId>`. It contains a `|`, so it took
   * the pinned-cutoff branch and hit the one-hour expiry check — paging
   * `sort=active` past anyone whose `lastActiveAt` was over an hour old
   * returned `400 Cursor has expired`. The existing test missed it because its
   * fixtures were all active seconds ago.
   */
  const recommendedCursor =
    query.cursor && query.sort === 'recommended'
      ? decodeOnlineOffsetCursor(query.cursor, now)
      : null
  const skipOffset =
    query.sort === 'nearby' && query.cursor
      ? decodeOffsetCursor(query.cursor)
      : (recommendedCursor?.offset ?? 0)
  const onlineCutoff =
    query.sort === 'recommended'
      ? (recommendedCursor?.cutoff ?? new Date(now.getTime() - ONLINE_WINDOW_MS))
      : null

  if (onlineCutoff) {
    pipeline.push({
      $addFields: {
        /**
         * Two expressions of one rule: this, and `hidesOnlineStatus` in
         * TypeScript for the read-time `isOnline`. Nothing but
         * `discovery.test.ts` holds them together — a profile that hides its
         * status must not be promoted here either, or the ordering leaks
         * exactly what the setting exists to hide.
         */
        onlineBucket: {
          $cond: [
            {
              $and: [
                { $gte: ['$stats.lastActiveAt', onlineCutoff] },
                { $ne: ['$privacy.hideOnlineStatus', true] },
              ],
            },
            1,
            0,
          ],
        },
      },
    })
  }

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
  } else if (query.sort === 'nearby') {
    /*
     * No `$sort` at all: `$geoNear` already emits nearest-first, and
     * re-sorting costs a blocking stage and throws that guarantee away.
     *
     * A chip used to be able to put online-first ahead of distance here. It is
     * gone rather than made unconditional — this sort is what Pro buys to
     * answer "who is near me", and bucketing first puts someone online 90 km
     * away ahead of someone offline in the next street.
     */
    if (query.cursor) pipeline.push({ $skip: skipOffset })
  } else {
    /*
     * Measured from the moment page one was served — the pinned online cutoff
     * plus its own window — so the dormant line holds still across pages for
     * the reason the online one does, with no new field in the cursor.
     */
    const dormantCutoff =
      rankReplyFirst && onlineCutoff
        ? new Date(onlineCutoff.getTime() + ONLINE_WINDOW_MS - DISCOVERY_DORMANT_DAYS * DAY_MS)
        : null

    // Small, capped arrays (MAX_LANGUAGES=5, MAX_INTERESTS=10) — cheap to
    // score with $setIntersection per candidate rather than needing a
    // separate scoring pass.
    const scoreTerms: Document[] = [
      { $size: { $setIntersection: [unpausedCodes('$learning.code'), myNativeCodes] } },
      { $size: { $setIntersection: [unpausedCodes('$nativeLanguages.code'), myLearningCodes] } },
      {
        $multiply: [0.5, { $size: { $setIntersection: ['$interests', viewer.interests] } }],
      },
    ]
    if (rankReplyFirst) {
      scoreTerms.push({ $multiply: [DISCOVERY_RESPONSIVENESS_WEIGHT, RESPONSIVENESS] })
    }

    pipeline.push(
      {
        $addFields: {
          score: { $add: scoreTerms },
          /*
           * After online-first and before the score: somebody away for weeks
           * is unlikely to answer this week, however well they fit. A missing
           * `lastActiveAt` compares below any date and lands here too.
           */
          ...(dormantCutoff
            ? {
                dormantBucket: {
                  $cond: [{ $lt: ['$stats.lastActiveAt', dormantCutoff] }, 1, 0],
                },
              }
            : {}),
        },
      },
      {
        $sort: dormantCutoff
          ? { onlineBucket: -1, dormantBucket: 1, score: -1, 'stats.lastActiveAt': -1, _id: 1 }
          : onlineCutoff
            ? { onlineBucket: -1, score: -1, 'stats.lastActiveAt': -1, _id: 1 }
            : { score: -1, 'stats.lastActiveAt': -1, _id: 1 },
      },
    )
    if (query.cursor) pipeline.push({ $skip: skipOffset })
  }

  // Fetch one extra to know whether a next page exists without a second round-trip.
  pipeline.push({ $limit: query.limit + 1 })

  const docs = await profiles
    .aggregate<Profile & { score?: number; distanceMeters?: number }>(pipeline)
    .toArray()
  const hasMore = docs.length > query.limit
  const page = hasMore ? docs.slice(0, query.limit) : docs

  const items = page.map((doc) => toDiscoveryItem(doc, now, replyFirst))

  let nextCursor: string | null = null
  if (hasMore) {
    const last = page.at(-1)
    if (last) {
      const nextOffset = page.length + skipOffset
      nextCursor =
        query.sort === 'active'
          ? encodeActiveCursor(new Date(last.stats.lastActiveAt), last._id)
          : onlineCutoff
            ? // The cutoff rides along so page two measures its offset against
              // the same boundary page one did.
              encodeOnlineOffsetCursor(onlineCutoff, nextOffset)
            : String(nextOffset)
    }
  }

  return { items, nextCursor }
}

/**
 * Every stored tier that buys a place in the strip — `pro`, and the retired
 * `pro_plus` until `scripts/merge-pro-tiers.ts` has rewritten those rows.
 * Derived from the plan table rather than listed, so it moves with
 * `boostedProfile`.
 */
const BOOSTED_STORED_TIERS = STORED_PLAN_TIERS.filter(
  (tier) => PLAN_LIMITS[normalizePlanTier(tier)].boostedProfile,
)

/**
 * The strip above the discovery list: paying members, inside exactly the same scope the list uses.
 *
 * Not a sort of the list and not a page of it. Boosted people appear in both,
 * deliberately — the strip is a second chance to be seen, not a promotion out
 * of the feed — so there is no dedupe and no cursor. `cursor` and `limit` are
 * accepted (the querystring is `discoveryQuerySchema`, a refined schema that
 * cannot be extended or narrowed) and ignored: the strip has one size.
 *
 * `sort` is not ignored, and that is the one thing here worth reading twice.
 * The strip sits at the top of a list the reader has asked a question of, so
 * it answers the same question: under Active it runs most-recently-seen
 * first, under Nearby nearest first, and only under the default feed does it
 * turn on its own — one order per viewer per hour, see `orderBoosted`.
 *
 * There used to be a tier band outside all three orders — Polyglot above
 * Fluent. With one paid plan there is nothing to band.
 */

export async function boostedProfiles(
  db: Db,
  viewerId: string,
  query: DiscoveryQuery,
): Promise<BoostedProfilesPage> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const [{ viewer, tier, match }, config] = await Promise.all([
    resolveDiscoveryScope(db, viewerId, query),
    getAppConfig(db),
  ])
  const now = new Date()

  /*
   * `$and` rather than a spread, and that is load-bearing.
   *
   * The scope's language fit is a top-level `$or` whenever the cross-match
   * fallback is on, and so is the expiry check below. Spread into one object
   * the second key wins and the first disappears — silently, since a `$match`
   * with one condition missing is a valid query that returns more. The strip
   * would have shown every paying member in the app regardless of language,
   * and nothing would have failed. Both halves are named here instead, where
   * neither can shadow the other.
   */
  const boostedConditions: Document = {
    'entitlement.tier': { $in: [...BOOSTED_STORED_TIERS] },
    /*
     * Absent means on. The flag is only ever written when somebody flips the
     * toggle, so a first-time subscriber is boosted the moment the
     * entitlement lands and no billing-side hook has to write a default — and
     * an explicit `false` survives a lapse and a re-subscribe, the way
     * `presenceVisibility.ts` says a billing event must never quietly change
     * a setting a person chose.
     */
    'settings.boosted': { $ne: false },
    /*
     * The Mongo half of `effectivePlanTier`: a lapsed subscription whose
     * EXPIRATION webhook is late or lost must not keep buying a place here.
     * `null` matches a missing field as well as a stored null, which is what
     * a lifetime grant looks like. That function's third branch — an
     * unparseable date — has no counterpart because this field is a BSON
     * Date, so there is no string here that could fail to parse.
     */
    $or: [{ 'entitlement.expiresAt': null }, { 'entitlement.expiresAt': { $gt: now } }],
  }

  const eligible = { $and: [match, boostedConditions] }

  /**
   * Whether this request can be answered by distance at all.
   *
   * The entitlement check is not ceremony copied from the list: `distanceKm`
   * rides back on every item `$geoNear` produces, so answering a free
   * account's `sort=nearby` here would hand it something only Pro buys. A
   * viewer with no point of their own has nothing to measure from.
   *
   * Neither case throws the way the list does. The list is the answer to the
   * reader's question and owes them the reason it cannot give one; the strip
   * is an advert above it, and an advert that 403s a screen already showing
   * that reason is noise. It falls back to the rotation instead.
   */
  const byDistance =
    query.sort === 'nearby' && hasFeature(tier, 'nearby') && viewer.location !== undefined

  /*
   * Two of the three orders are now entirely MQL, so the cut and the
   * presentation are the same sort and the candidate ceiling has nothing left
   * to do — `$limit` is the strip's own size.
   *
   * The default feed is still the exception, because `orderBoosted` hashes the
   * viewer, the profile and the hour together and MQL has no string hash. There
   * the sort below decides only the truncation: recency, because a ceiling has
   * to cut somewhere and cutting by natural order would be arbitrary.
   */
  const rotates = !byDistance && query.sort !== 'active'

  const docs = await profiles
    .aggregate<Profile & { distanceMeters?: number }>([
      /*
       * `$geoNear` must lead the pipeline, so the eligibility match goes in as
       * its `query` — the same trick `discoverProfiles` explains at length.
       * `maxDistance` appears only when the searcher drew a circle, and then
       * the strip is bounded by the same circle as the list: a card 300 km
       * away above a list that promised 10 is not a placement, it is a
       * contradiction.
       *
       * A 2dsphere index is sparse, so this drops boosted members who share no
       * location. They paid, and it is still right: the list underneath drops
       * them for the same reason, and a distance-ordered strip has no honest
       * place to put somebody with no distance.
       */
      byDistance && viewer.location
        ? {
            $geoNear: {
              near: viewer.location,
              distanceField: 'distanceMeters',
              ...(query.radiusKm !== undefined ? { maxDistance: query.radiusKm * 1000 } : {}),
              key: 'location',
              spherical: true,
              query: eligible,
            },
          }
        : { $match: eligible },
      /*
       * The match above is still served by `discovery_native_active` /
       * `discovery_learning_active` — or by `location_2dsphere` on the nearby
       * branch — and what reaches it is the paying members inside one language
       * fit: a handful of documents, not a collection. That is why there is no
       * new index for this.
       */
      {
        $sort: byDistance ? { distanceMeters: 1, _id: 1 } : { 'stats.lastActiveAt': -1, _id: 1 },
      },
      { $limit: rotates ? DISCOVERY_BOOSTED_CANDIDATE_MAX : DISCOVERY_BOOSTED_LIMIT },
    ])
    .toArray()

  const ordered = rotates
    ? orderBoosted(docs, viewerId, now).slice(0, DISCOVERY_BOOSTED_LIMIT)
    : docs

  return {
    items: ordered.map((doc) => ({
      ...toDiscoveryItem(doc, now, config.flags.discoveryReplyFirst),
      // Always `pro` on the wire, whichever spelling the row still has. Sent
      // only for apps released before the single plan, which draw a chip
      // from it; `boostedProfileSchema` says why.
      tier: 'pro' satisfies BoostedProfile['tier'],
    })),
  }
}

/**
 * "New on LangX": accounts made in the last `DISCOVERY_NEW_DAYS`, newest
 * first, inside exactly the scope the list uses.
 *
 * Its own endpoint rather than a mode of `/discovery/boosted`. Every build in
 * the stores draws what that one returns under a "Boosted" label, so a
 * newcomer sent down it would be called a paying member on every old phone.
 *
 * **Adults only, at both ends.** A fresh account is the one a stranger is most
 * likely to write to first, which is what the strip is for and exactly why a
 * 16- or 17-year-old is never on it; and a minor viewer gets an empty strip,
 * because a row of brand-new strangers is not what their Discover should lead
 * with. The exact birthday, not the year arithmetic the age on a card uses —
 * see `adultBornOnOrBefore`. A missing birth date matches nothing.
 *
 * Off with the rest of reply-first: an empty strip, which the app hides. The
 * cursor, limit and sort of the shared querystring are ignored, as on the
 * boosted strip — one size, one order. People the viewer already talks to are
 * left out, as on the default list.
 *
 * `joined` (`{ createdAt: -1 }`) serves the range and the sort; nothing was
 * added to `indexes.ts` for it.
 */
export async function newProfiles(
  db: Db,
  viewerId: string,
  query: DiscoveryQuery,
): Promise<NewProfilesPage> {
  if (!(await getAppConfig(db)).flags.discoveryReplyFirst) return { items: [] }

  const { viewer, match } = await resolveDiscoveryScope(db, viewerId, query)
  const now = new Date()
  // A guest's `1900-01-01` is a placeholder, not an age: nobody has asked
  // them one yet, so they are not known to be an adult and get the empty strip.
  if (viewer.guest === true || !isAdult(viewer.birthDate, now)) return { items: [] }

  const partnerIds = await conversationPartnerIds(db, viewerId)

  const docs = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .aggregate<Profile>(newProfilesPipeline(match, partnerIds, now))
    .toArray()

  return { items: docs.map((doc) => toDiscoveryItem(doc, now, true)) }
}

/**
 * The strip's pipeline, exported so the index test explains the one that
 * runs rather than a copy of it that could drift.
 */
export function newProfilesPipeline(
  match: Document,
  partnerIds: readonly string[],
  now: Date,
): Document[] {
  return [
    {
      $match: {
        // `$and`, for `boostedProfiles`' reason: the scope carries an `_id`
        // and, under an age filter, a `birthDate` of its own.
        $and: [
          match,
          {
            _id: { $nin: [...partnerIds] },
            createdAt: { $gte: new Date(now.getTime() - DISCOVERY_NEW_DAYS * DAY_MS) },
            birthDate: { $lte: adultBornOnOrBefore(now) },
          },
        ],
      },
    },
    { $sort: { createdAt: -1, _id: 1 } },
    { $limit: DISCOVERY_NEW_LIMIT },
  ]
}
