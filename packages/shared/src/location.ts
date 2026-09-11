import { z } from 'zod'

/**
 * Location, and the two things the product does with it: store where somebody
 * roughly is, and tell somebody else roughly how far away that is.
 *
 * Everything here is deliberately imprecise. A language-exchange app needs to
 * answer "is this person in my city" and nothing finer, so storing a finer
 * answer than that would only ever be a liability — see `coarsen` below.
 */

/**
 * Coordinates are rounded to this many decimal places **before** they are
 * stored, and the raw reading is discarded.
 *
 * Two decimals is a grid of roughly 1.1 km north-south (less east-west the
 * further you are from the equator), which is the resolution the feature
 * actually needs: everyone in a neighbourhood collapses onto one point.
 *
 * This is the privacy design, not an optimisation. The device can report a
 * position accurate to a few metres, and a database that holds that can place
 * a user at their front door — a risk that outlives any intent we had for it.
 * Rounding at the boundary means the precise value never exists on the server
 * at all, so nothing later — a leak, a subpoena, a careless export — can hand
 * it out.
 */
export const LOCATION_PRECISION_DECIMALS = 2

/**
 * The largest radius the filter offers, and the last distance bucket.
 *
 * It was once the cap `sort=nearby` always ran under, on the argument that a
 * result 3,000 km away is not "nearby" but merely nearest. The argument was
 * about the word rather than about the person reading it: somebody who opens a
 * list sorted by distance wants the nearest people there are, and a silent
 * 500 km wall told them the app was empty when what was true is that it was
 * empty *near them*. So the radius is a filter now — absent means no limit —
 * and this is where its highest option sits.
 *
 * What that gives up is named in `decisions.md`: unbounded, `$geoNear` walks
 * the index outward until the page is full, so a viewer with a rare language
 * pair can pull most of the index before they have twenty rows.
 */
/**
 * How stale a shared location may get before the app quietly refreshes it.
 *
 * One hour. It was six, on the argument that `LOCATION_PRECISION_DECIMALS`
 * rounds the point to about a kilometre so a finer refresh mostly writes the
 * same cell back — true, and also how a person who crossed a city after lunch
 * stayed "nearby" the wrong people until the evening. An hour is the age the
 * device's own cached fix is allowed to have (`captureLocation`'s `maxAge`),
 * so a gap below it would only re-read the cache; this is the floor at which
 * a refresh can actually learn something.
 *
 * There is no background permission — `app.config.ts` disables it on both
 * platforms and says why — so this is a floor on how often a *foreground*
 * refresh may happen, not a schedule.
 */
export const LOCATION_REFRESH_MIN_GAP_MS = 60 * 60 * 1000

export const NEARBY_MAX_KM = 500

/** Radii the filter offers, beside "any". Any value up to {@link NEARBY_MAX_KM} is accepted. */
export const NEARBY_RADIUS_OPTIONS_KM = [25, 100, NEARBY_MAX_KM] as const

/**
 * Distances are reported as one of these, never as the number that came out
 * of the query.
 *
 * Coarse storage alone is not enough. Distance from a single point is a
 * circle, but an attacker who can move — a second account, a VPN, a walk
 * around the block — reads three circles and gets an intersection, and that
 * intersection is far tighter than the 1.1 km cell the coordinates were
 * rounded to. Bucketing breaks that: every position inside a band reports the
 * same number, so the circles stop being circles.
 */
export const DISTANCE_BUCKETS_KM = [1, 2, 5, 10, 25, 50, 100, 250, NEARBY_MAX_KM] as const

export interface GeoPoint {
  type: 'Point'
  coordinates: [number, number]
}

/** The body of `POST /profiles/me/location` — what a device reports. */
export const locationInputSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})
export type LocationInput = z.infer<typeof locationInputSchema>

/** Rounds one coordinate onto the {@link LOCATION_PRECISION_DECIMALS} grid. */
export function coarsen(value: number): number {
  const factor = 10 ** LOCATION_PRECISION_DECIMALS
  return Math.round(value * factor) / factor
}

/**
 * The only way a `GeoPoint` is built anywhere in the codebase, for two
 * reasons: it is where coarsening is guaranteed to happen, and GeoJSON orders
 * a point `[lng, lat]` while every human-facing API in the world says "lat,
 * lng" — a swap that is silent, plausible, and puts everyone in the wrong
 * hemisphere.
 */
export function toGeoPoint({ lat, lng }: LocationInput): GeoPoint {
  return { type: 'Point', coordinates: [coarsen(lng), coarsen(lat)] }
}

/**
 * Metres from the database → the number a profile card is allowed to show.
 *
 * Rounds **up** to a bucket edge, so the value is always an upper bound and
 * the UI can honestly render it as "under 5 km" rather than "5 km", which
 * would be a claim about a distance nobody measured.
 */
export function bucketDistanceKm(meters: number): number {
  const km = meters / 1000
  // The fallback is the normal case past the last edge now that the query runs
  // unbounded unless a radius was asked for: everyone beyond `NEARBY_MAX_KM`
  // reports that edge, which `formatDistance` words as a floor rather than a
  // ceiling.
  return DISTANCE_BUCKETS_KM.find((edge) => km <= edge) ?? NEARBY_MAX_KM
}

/** Renders a bucket edge. The largest one is a floor, not a ceiling, so it reads the other way round. */
export function formatDistance(bucketKm: number): string {
  return bucketKm >= NEARBY_MAX_KM ? `${NEARBY_MAX_KM}+ km away` : `under ${bucketKm} km away`
}
