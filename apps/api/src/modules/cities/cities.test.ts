import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import { CITY_MATCH_MAX_METRES, nearestCity, searchCities, type City } from './cities'

function city(id: string, name: string, lng: number, lat: number, population: number): City {
  return {
    _id: id,
    name,
    asciiName: name.normalize('NFD').replace(/[̀-ͯ]/g, ''),
    countryCode: 'TR',
    population,
    location: { type: 'Point', coordinates: [lng, lat] },
  }
}

describe('cities', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_cities_test')
    await ensureIndexes(handle.db)
    await handle.db.collection<City>(COLLECTIONS.cities).insertMany([
      city('geonames:745044', 'Istanbul', 28.9784, 41.0082, 15_000_000),
      city('geonames:323786', 'Ankara', 32.8597, 39.9334, 5_600_000),
      city('geonames:311046', 'Izmir', 27.1428, 38.4237, 3_000_000),
      city('geonames:000001', 'Isparta', 30.5566, 37.7648, 250_000),
      // A district of Istanbul, nearer than the city's own point to most
      // coordinates in the middle of it.
      city('geonames:747538', 'Eminonu', 28.9701, 41.0175, 30_000),
      // A separate town an hour up the coast, far enough out to keep its name.
      city('geonames:000002', 'Silivri', 28.2464, 41.0736, 60_000),
    ])
  }, 120_000)

  afterAll(async () => {
    await handle?.close()
    await replSet?.stop()
  })

  describe('nearestCity', () => {
    it('finds the city a coordinate is in', async () => {
      const found = await nearestCity(handle.db, [28.98, 41.01])
      expect(found?.name).toBe('Istanbul')
    })

    it('finds the nearest one when nothing larger is beside it', async () => {
      const found = await nearestCity(handle.db, [32.86, 39.94])
      expect(found?.name).toBe('Ankara')
    })

    /**
     * The point of the preference rule. GeoNames carries a metropolis and its
     * districts side by side, so the literal nearest entry to a coordinate in
     * the middle of Istanbul is a district nobody would name.
     */
    it('says the city, not the district it happens to be standing in', async () => {
      const found = await nearestCity(handle.db, [28.9705, 41.0176])
      expect(found?.name).toBe('Istanbul')
    })

    /** And not the other way: a town of its own keeps its own name. */
    it('does not swallow a separate town into the city up the road', async () => {
      const found = await nearestCity(handle.db, [28.2464, 41.0736])
      expect(found?.name).toBe('Silivri')
    })

    /**
     * The middle of the Atlantic. Without a bound the nearest city is a real
     * place a thousand kilometres away, and a profile would claim to be there.
     */
    it('is nothing at all when the coordinate is nowhere near a city', async () => {
      expect(await nearestCity(handle.db, [-30, 30])).toBeNull()
    })

    it('is nothing just past the bound', async () => {
      // A degree of latitude is about 111 km, so one degree north of Ankara is
      // outside the limit and half a degree is inside it.
      const outside = CITY_MATCH_MAX_METRES / 111_000 + 0.1
      expect(await nearestCity(handle.db, [32.8597, 39.9334 + outside])).toBeNull()
      expect(await nearestCity(handle.db, [32.8597, 39.9334 + 0.4])).not.toBeNull()
    })
  })

  describe('searchCities', () => {
    it('matches a prefix, largest first', async () => {
      const found = await searchCities(handle.db, 'Is', 10)
      expect(found.map((row) => row.name)).toEqual(['Istanbul', 'Isparta'])
    })

    it('does not care about case', async () => {
      expect((await searchCities(handle.db, 'ista', 10))[0]?.name).toBe('Istanbul')
    })

    it('is a prefix, not a substring — nobody types the middle of a city', async () => {
      expect(await searchCities(handle.db, 'stanbul', 10)).toEqual([])
    })

    /** A `.` in an unescaped regex turns a prefix match into a whole-collection scan. */
    it('treats a regex metacharacter as a character', async () => {
      expect(await searchCities(handle.db, '.*', 10)).toEqual([])
    })

    it('returns nothing for an empty term rather than everything', async () => {
      expect(await searchCities(handle.db, '   ', 10)).toEqual([])
    })

    it('honours the limit', async () => {
      expect(await searchCities(handle.db, 'I', 1)).toHaveLength(1)
    })
  })
})
