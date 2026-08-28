import { describe, expect, it } from 'vitest'
import {
  DISTANCE_BUCKETS_KM,
  LOCATION_PRECISION_DECIMALS,
  NEARBY_MAX_KM,
  bucketDistanceKm,
  coarsen,
  formatDistance,
  locationInputSchema,
  toGeoPoint,
} from './location'

describe('coarsening', () => {
  it('rounds onto the documented grid rather than storing what the device reported', () => {
    // A GPS fix with metre precision — the thing that must never reach the database.
    expect(coarsen(41.008238)).toBe(41.01)
    expect(coarsen(28.978359)).toBe(28.98)
  })

  it('collapses two points a few hundred metres apart onto the same cell', () => {
    expect(coarsen(41.0121)).toBe(coarsen(41.0089))
  })

  it('keeps the southern and western hemispheres negative', () => {
    expect(coarsen(-33.868821)).toBe(-33.87)
    expect(coarsen(-70.6693)).toBe(-70.67)
  })

  it('never returns more decimals than it promises', () => {
    for (const value of [12.3456789, -0.000001, 179.999999, -89.987654]) {
      const decimals = (String(coarsen(value)).split('.')[1] ?? '').length
      expect(decimals).toBeLessThanOrEqual(LOCATION_PRECISION_DECIMALS)
    }
  })
})

describe('toGeoPoint', () => {
  it('emits GeoJSON order — [lng, lat], not the "lat, lng" every human API says', () => {
    expect(toGeoPoint({ lat: 41.0082, lng: 28.9784 })).toEqual({
      type: 'Point',
      coordinates: [28.98, 41.01],
    })
  })

  it('coarsens on the way in, so nothing precise can be stored by going through it', () => {
    const point = toGeoPoint({ lat: 41.008238, lng: 28.978359 })
    expect(point.coordinates).toEqual([28.98, 41.01])
  })
})

describe('locationInputSchema', () => {
  it('accepts a real coordinate pair', () => {
    expect(locationInputSchema.parse({ lat: 41.0082, lng: 28.9784 })).toEqual({
      lat: 41.0082,
      lng: 28.9784,
    })
  })

  it.each([
    { lat: 91, lng: 0 },
    { lat: -91, lng: 0 },
    { lat: 0, lng: 181 },
    { lat: 0, lng: -181 },
  ])('rejects out-of-range %o', (input) => {
    expect(locationInputSchema.safeParse(input).success).toBe(false)
  })
})

describe('distance buckets', () => {
  it('rounds up to a bucket edge, so the number shown is always an upper bound', () => {
    expect(bucketDistanceKm(300)).toBe(1)
    expect(bucketDistanceKm(1_400)).toBe(2)
    expect(bucketDistanceKm(4_900)).toBe(5)
    expect(bucketDistanceKm(26_000)).toBe(50)
  })

  it('reports the same value across a whole band — the point of bucketing', () => {
    // Three readings that trilateration would separate; one answer that does not.
    expect(bucketDistanceKm(10_100)).toBe(bucketDistanceKm(24_900))
  })

  it('caps at the search radius, which is as far as the query ever looks', () => {
    expect(bucketDistanceKm(NEARBY_MAX_KM * 1000)).toBe(NEARBY_MAX_KM)
    expect(bucketDistanceKm(9_000_000)).toBe(NEARBY_MAX_KM)
  })

  it('has ascending edges, or `find` would return the wrong one', () => {
    const sorted = [...DISTANCE_BUCKETS_KM].sort((a, b) => a - b)
    expect([...DISTANCE_BUCKETS_KM]).toEqual(sorted)
  })

  it('reads as an upper bound below the cap and a lower bound at it', () => {
    expect(formatDistance(5)).toBe('under 5 km away')
    expect(formatDistance(NEARBY_MAX_KM)).toBe(`${NEARBY_MAX_KM}+ km away`)
  })
})
