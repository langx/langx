import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'

/**
 * A canonical place, so that "the city someone is in" and "the city someone is
 * looking for" are the same kind of thing.
 *
 * They used to be two kinds. A profile carried whatever its owner typed, a
 * filter carried whatever the searcher typed, and `cityKey` folded both into a
 * comparable form — Turkish dotted I, diacritics, punctuation — which is a lot
 * of machinery to make two pieces of free text agree. Both ends now come from
 * this list, so an id is the whole of the matching.
 */
export interface City {
  /** `geonames:745044`. Prefixed so a second source could never collide. */
  _id: string
  name: string
  /** Folded to ASCII by the source, and what a prefix search runs against. */
  asciiName: string
  countryCode: string
  /** The province or state, to tell four Springfields apart. */
  admin1?: string
  population: number
  location: { type: 'Point'; coordinates: [number, number] }
}

export interface CityView {
  id: string
  name: string
  countryCode: string
  admin1?: string
}

/**
 * How far a coordinate may be from a city and still be "in" it.
 *
 * Stored coordinates are already rounded to two decimals — about 1.1 km — so
 * this is not about precision. It is about the middle of the sea: without a
 * bound, the nearest city to a coordinate in the Atlantic is a real place
 * hundreds of kilometres away, and the profile would claim to be there.
 */
export const CITY_MATCH_MAX_METRES = 100_000

/**
 * Within this, the better-known place wins over the nearer one.
 *
 * GeoNames lists a metropolis and its own districts side by side, so the
 * *nearest* entry to a coordinate in central Istanbul is "Eminönü" — accurate,
 * and not what anybody would say or search for. Inside a city's own sprawl the
 * name people use is the city's.
 *
 * Bounded, rather than "largest within the whole match radius", for the
 * failure the other way: a small town forty kilometres from a capital is its
 * own place, and naming it after the capital would be wrong in a direction
 * nobody could correct.
 */
export const CITY_PREFER_LARGER_WITHIN_METRES = 25_000

export function toCityView(city: City): CityView {
  return {
    id: city._id,
    name: city.name,
    countryCode: city.countryCode,
    ...(city.admin1 ? { admin1: city.admin1 } : {}),
  }
}

/**
 * The city a coordinate is in, or `null` when it is nowhere near one.
 *
 * "In" is not quite "nearest" — see `CITY_PREFER_LARGER_WITHIN_METRES`. The
 * candidates are the closest handful; among those close enough to be the same
 * conurbation, the largest wins.
 */
export async function nearestCity(db: Db, coordinates: [number, number]): Promise<City | null> {
  const candidates = await db
    .collection<City>(COLLECTIONS.cities)
    .aggregate<City & { metres: number }>([
      {
        $geoNear: {
          near: { type: 'Point', coordinates },
          distanceField: 'metres',
          maxDistance: CITY_MATCH_MAX_METRES,
          spherical: true,
        },
      },
      { $limit: 12 },
    ])
    .toArray()
  if (candidates.length === 0) return null

  const nearby = candidates.filter((city) => city.metres <= CITY_PREFER_LARGER_WITHIN_METRES)
  const pool = nearby.length > 0 ? nearby : candidates
  return pool.reduce((best, city) => (city.population > best.population ? city : best))
}

/**
 * Cities whose name starts with what has been typed so far.
 *
 * A prefix rather than a substring: an index can answer the first and cannot
 * answer the second, and nobody searching for a city types the middle of it.
 * Ordered by population, because someone typing "san" means the large one.
 */
export async function searchCities(db: Db, term: string, limit: number): Promise<CityView[]> {
  // Escaped: a search term is user input, and `.` or `*` in an unescaped regex
  // turns a prefix match into a scan of the whole collection.
  const prefix = term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!prefix) return []
  const rows = await db
    .collection<City>(COLLECTIONS.cities)
    .find({ asciiName: { $regex: `^${prefix}`, $options: 'i' } })
    .sort({ population: -1 })
    .limit(limit)
    .toArray()
  return rows.map(toCityView)
}
