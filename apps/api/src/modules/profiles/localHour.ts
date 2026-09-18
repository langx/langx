import { localHour } from '@langx/shared'
import type { Db, Filter } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from './profiles'

/**
 * Everybody matching `filter` for whom `now` reads as `hour` on their own
 * clock.
 *
 * Six scheduled passes ask this, and every one of them used to ask it the same
 * expensive way: read every profile in the database, then keep the one in
 * twenty-four whose local hour matched. That is the whole collection — bios,
 * language arrays, name tokens, cosmetics — pulled across the wire and
 * deserialised twice an hour, to address a slice of it.
 *
 * The zone is what decides, so the zones are what we ask for first. `distinct`
 * answers from the `timezone` index with one entry per *value* rather than per
 * document — a few dozen strings however many people have signed up — and the
 * query that follows fetches only the readers. The cost stops scaling with the
 * user base and starts scaling with the audience, which is what a per-timezone
 * pass should have cost all along.
 *
 * The `distinct` is deliberately **unfiltered**: a zone nobody eligible is in
 * costs one wasted string, and asking it to apply the filter would make it
 * read documents to do so, which is the thing being removed. `filter` still
 * decides who comes back, on the query below where it belongs — and it is
 * `$and`-ed rather than spread, so a caller's own `$or` survives.
 */
export async function profilesInLocalHour(
  db: Db,
  hour: number,
  now: Date,
  filter: Filter<Profile>,
): Promise<Profile[]> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const stored = await profiles.distinct('timezone')
  const due = stored.filter(
    (zone): zone is string => zone !== undefined && localHour(now, zone) === hour,
  )

  const zones: Filter<Profile>[] = []
  if (due.length > 0) zones.push({ timezone: { $in: due } })
  /*
   * A profile with no `timezone` is UTC, as it is everywhere else — and it is
   * the one reader this shape could lose, because `distinct` lists values and
   * an absent field has none. So the UTC hour asks for the absence by name;
   * every other hour must not, or it would send to everybody.
   */
  if (localHour(now, 'UTC') === hour) zones.push({ timezone: { $exists: false } })
  if (zones.length === 0) return []

  return profiles.find({ $and: [filter, { $or: zones }] }).toArray()
}
