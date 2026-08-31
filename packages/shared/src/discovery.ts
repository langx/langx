import { languageLevelSchema, levelRank } from './level'
import { NEARBY_MAX_KM } from './location'
import { countryCodeSchema } from './countries'
import { languageCodeSchema } from './languages'
import { CITY_MAX_LENGTH, genderSchema } from './profile'
import { z } from 'zod'

/**
 * v1 offered five discovery tabs (For You / Enthusiasts / New Users / Active /
 * Visitors). v2's MVP collapses that to two sort presets over one aggregation
 * — "recommended" (scored) and "active" (`stats.lastActiveAt desc`, the same
 * field the discovery indexes are already built on). "New Users" would need a
 * fresh `createdAt` index and "Enthusiasts" depends on the badge system —
 * both P1. Visitors already exists separately as `profileViews` (Pro).
 *
 * `nearby` came later and is the one sort that is not free: it is Pro+
 * (`PLAN_LIMITS.nearby`), it needs the viewer to have shared a location of
 * their own, and it only ever sees candidates who have shared one too.
 */
export const DISCOVERY_SORTS = ['recommended', 'active', 'nearby'] as const
export type DiscoverySort = (typeof DISCOVERY_SORTS)[number]
export const discoverySortSchema = z.enum(DISCOVERY_SORTS)

export const DISCOVERY_PAGE_SIZE_DEFAULT = 20
export const DISCOVERY_PAGE_SIZE_MAX = 50

/** A profile counts as "online now" — for the ordering, and for `isOnline` — within this window. */
export const ONLINE_WINDOW_MS = 5 * 60 * 1000

/**
 * How stale a discovery cursor may be before it is refused.
 *
 * The `online` ordering pins its five-minute cutoff into the cursor so the
 * partition cannot move mid-scroll. Left unbounded that pin eventually
 * classifies everyone as online and the ordering silently stops meaning
 * anything — degraded rather than corrupt, and impossible to diagnose.
 */
export const DISCOVERY_CURSOR_MAX_AGE_MS = 60 * 60 * 1000

/** How often a connected client tells the server it is still there. */
export const PRESENCE_HEARTBEAT_MS = 60_000

/**
 * Server-side floor between two presence writes for one socket.
 *
 * Below the heartbeat rather than equal to it: at equal values a heartbeat
 * arriving a millisecond early is silently dropped, and the next one is a
 * whole interval away, so a connected user flickers offline for no reason.
 */
export const PRESENCE_WRITE_MIN_GAP_MS = 50_000

/**
 * The one definition of "online".
 *
 * It used to be written out three times — twice in the API and once as a
 * local constant in `profiles.ts` that did not import the shared window at
 * all, so changing it here would have moved two of the three.
 */
export function isOnlineAt(lastActiveAt: Date | string, now: Date = new Date()): boolean {
  return now.getTime() - new Date(lastActiveAt).getTime() < ONLINE_WINDOW_MS
}

/**
 * Keys that require Pro (`PLAN_LIMITS.advancedFilters`). A free account
 * sending any of these gets `403 UPGRADE_REQUIRED`, not a silently-ignored
 * parameter — see "Paywall rules" in the plan.
 *
 * Level, age and country used to be here and are free now. They are how
 * somebody finds a partner they can actually talk to — a beginner matched with
 * a beginner has no conversation — and charging for that made the free tier
 * worse at the one thing the product is for. `promise-change.md` names filters
 * as one of three things v2 took away from "free forever"; this gives most of
 * it back before that document is published.
 *
 * The rule that decides the rest: **a paid filter names somebody else's
 * attribute; a free one names only your own.** `gender` and `city` take a
 * value and point it at other people — they are ways of searching. The one
 * that left, `onlyMyGender`, takes no value at all: it is resolved from the
 * caller's own profile and is inert for anybody who did not disclose one, so
 * there is no third party it can be aimed at.
 *
 * That rule replaces an earlier one. `onlyMyGender` was paid on the grounds
 * that it is "used for safety rather than preference", and the two were gated
 * together because splitting them looked harder to explain than it was worth.
 * Both halves turned out to be wrong. Charging for it did not make anyone
 * safer, and it is the one filter that can only ever make an already-small
 * pool smaller — so the account most likely to hit the paywall is the one
 * already being shown too few people, and what it learns is that the app is
 * empty. It is a comfort setting, and comfort is not a thing to sell.
 */
export const DISCOVERY_PRO_FILTER_KEYS = ['gender', 'city'] as const

export const discoveryQuerySchema = z
  .object({
    sort: discoverySortSchema.default('recommended'),
    /** Opaque token from the previous page's `nextCursor`. Never parse it client-side. */
    cursor: z.string().optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(DISCOVERY_PAGE_SIZE_MAX)
      .default(DISCOVERY_PAGE_SIZE_DEFAULT),
    /** Free filter: narrow to one specific language out of the viewer's own learning list. */
    targetLanguage: languageCodeSchema.optional(),
    /** Free filter: their level in the viewer's language, as an inclusive band.
     *  One bound on its own is still valid — `minLevel` alone means "at least",
     *  which is what the pre-v3 filter offered and what old clients still send. */
    minLevel: languageLevelSchema.optional(),
    maxLevel: languageLevelSchema.optional(),
    /** Free filters. */
    ageMin: z.coerce.number().int().min(18).optional(),
    ageMax: z.coerce.number().int().min(18).optional(),
    country: countryCodeSchema.optional(),
    /**
     * How far `sort=nearby` looks. Ignored by every other sort.
     *
     * Deliberately **not** in `DISCOVERY_PRO_FILTER_KEYS`: it is a parameter
     * of a sort that is already gated, not a filter of its own, and listing it
     * there would refuse a free account over a value that cannot affect the
     * query it is actually allowed to run.
     */
    radiusKm: z.coerce.number().min(1).max(NEARBY_MAX_KM).default(NEARBY_MAX_KM),
    /**
     * v1's "Match My Gender". Free, and the only gender filter that is — see
     * `DISCOVERY_PRO_FILTER_KEYS` for the line between them.
     *
     * Resolved on the server rather than translated into `gender` by the
     * client: only the server is certain what the viewer's own gender is, and
     * a client that had not finished loading its own profile would otherwise
     * send an unfiltered query that silently looked like it had applied.
     * Ignored when the viewer's own gender is `undisclosed` — "people like me"
     * cannot mean "people who also declined to say".
     *
     * That last clause is why `POST /profiles/me/gender` exists: `gender` is
     * set once and never edited, so without a way to disclose one afterwards
     * this toggle would be permanently dead for anybody who skipped the
     * question at onboarding.
     */
    onlyMyGender: z.coerce.boolean().optional(),
    // Pro-only from here down.
    gender: genderSchema.optional(),
    /**
     * Free text, matched on `cityKey` rather than on itself — see `city.ts`.
     * Length-bounded for the same reason every other free-text query is: it
     * reaches a database index, and an unbounded string is a way to make it
     * scan.
     */
    city: z.string().trim().min(1).max(CITY_MAX_LENGTH).optional(),
  })
  .refine((q) => q.ageMin === undefined || q.ageMax === undefined || q.ageMin <= q.ageMax, {
    message: 'ageMin cannot exceed ageMax',
    path: ['ageMin'],
  })
  .refine(
    (q) =>
      q.minLevel === undefined ||
      q.maxLevel === undefined ||
      levelRank(q.minLevel) <= levelRank(q.maxLevel),
    { message: 'minLevel cannot exceed maxLevel', path: ['minLevel'] },
  )
  .refine((q) => !(q.onlyMyGender && q.gender), {
    message: 'Pick a gender or match your own, not both',
    path: ['onlyMyGender'],
  })

export type DiscoveryQuery = z.infer<typeof discoveryQuerySchema>

export const discoveryItemSchema = z.object({
  _id: z.string(),
  handle: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().optional(),
  bio: z.string().optional(),
  country: z.string().optional(),
  gender: genderSchema,
  age: z.number().int(),
  nativeLanguages: z.array(z.object({ code: languageCodeSchema })),
  learning: z.array(
    z.object({ code: languageCodeSchema, level: languageLevelSchema, priority: z.number() }),
  ),
  isOnline: z.boolean(),
  streak: z.object({ current: z.number().int() }),
  /**
   * Present only on `sort=nearby`, and always an edge from
   * `DISTANCE_BUCKETS_KM` rather than the measured distance — see
   * `bucketDistanceKm` for why the real number never leaves the server.
   */
  distanceKm: z.number().optional(),
})
export type DiscoveryItem = z.infer<typeof discoveryItemSchema>

export const discoveryPageSchema = z.object({
  items: z.array(discoveryItemSchema),
  nextCursor: z.string().nullable(),
})
export type DiscoveryPage = z.infer<typeof discoveryPageSchema>

/** How many results a handle search returns. Small on purpose: it is a
 *  jump-to, not a browse — the list below is what browsing is for. */
export const HANDLE_SEARCH_LIMIT = 10

export const handleSearchQuerySchema = z.object({
  /**
   * A handle prefix. Lower-cased to match how handles are stored, and bounded
   * at the same length one can be, because this reaches a database index and
   * an unbounded string is a way to make it scan.
   */
  q: z.string().trim().toLowerCase().min(2).max(20),
})
export type HandleSearchQuery = z.infer<typeof handleSearchQuerySchema>

export const handleSearchResultSchema = z.object({
  _id: z.string(),
  handle: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().optional(),
})
export type HandleSearchResult = z.infer<typeof handleSearchResultSchema>

export const handleSearchPageSchema = z.object({ items: z.array(handleSearchResultSchema) })
export type HandleSearchPage = z.infer<typeof handleSearchPageSchema>
