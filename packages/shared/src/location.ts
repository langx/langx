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
 * How far `sort=nearby` will look before giving up.
 *
 * A cap is required rather than merely tidy: without one, `$geoNear` walks the
 * index outward from the viewer until it has filled a page, so a user with
 * nobody within a thousand kilometres pays for a scan of the entire index to
 * be told exactly that. It also keeps the word honest — a result 3,000 km away
 * is not "nearby", it is just the nearest, and showing it would make the sort
 * look broken rather than empty.
 */
/**
 * How stale a shared location may get before the app quietly refreshes it.
 *
 * Six hours, and the number follows from `LOCATION_PRECISION_DECIMALS`: the
 * stored point is rounded to about a kilometre, so anything finer than a few
 * hours mostly writes the same cell back and spends a GPS wake-up to do it.
 *
 * There is no background permission — `app.config.ts` disables it on both
 * platforms and says why — so this is a floor on how often a *foreground*
 * refresh may happen, not a schedule.
 */
export const LOCATION_REFRESH_MIN_GAP_MS = 6 * 60 * 60 * 1000

export const NEARBY_MAX_KM = 500

/** Radii the UI offers. Any value up to {@link NEARBY_MAX_KM} is accepted. */
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
  // The final edge is `NEARBY_MAX_KM`, which the query never exceeds, so the
  // fallback is unreachable in practice — it is here so the function is total.
  return DISTANCE_BUCKETS_KM.find((edge) => km <= edge) ?? NEARBY_MAX_KM
}

/** Renders a bucket edge. The largest one is a floor, not a ceiling, so it reads the other way round. */
export function formatDistance(bucketKm: number): string {
  return bucketKm >= NEARBY_MAX_KM ? `${NEARBY_MAX_KM}+ km away` : `under ${bucketKm} km away`
}
