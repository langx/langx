import { DISCOVERY_BOOSTED_FRESH_MS, DISCOVERY_BOOSTED_ROTATION_MS } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { type BoostedCandidate, orderBoosted } from './boostedOrder'

/**
 * Every assertion here is deterministic — SHA-256 over fixed ids in fixed
 * buckets — so none of these can flake. The ids and bucket ranges are
 * load-bearing because of that: if one ever fails on a first run, the fix is a
 * wider range or different ids, never a looser bound. A bound loose enough to
 * pass whatever the code does would stop catching a broken seed, which is the
 * only thing these tests exist to catch.
 */

const BUCKET = 500_000
const AT = new Date(BUCKET * DISCOVERY_BOOSTED_ROTATION_MS)

function candidate(
  id: string,
  tier: 'pro' | 'pro_plus',
  lastActiveAgoMs: number,
  at: Date = AT,
): BoostedCandidate {
  return {
    _id: id,
    entitlement: { tier },
    stats: { lastActiveAt: new Date(at.getTime() - lastActiveAgoMs) },
  }
}

const HOUR = DISCOVERY_BOOSTED_ROTATION_MS
const DAY = 24 * HOUR

/** One bucket's leader, for a viewer, as an id. */
function leader(candidates: BoostedCandidate[], viewerId: string, at: Date): string {
  return orderBoosted(candidates, viewerId, at)[0]!._id
}

describe('orderBoosted', () => {
  /**
   * The paywall sells this sentence — "Polyglot profiles lead the Boosted
   * strip, ahead of Fluent" — so it has to survive every roll of the rotation,
   * including the worst case where the Fluent profile is the active one. This
   * is the test that catches a reordered comparator.
   */
  it('never lets a Fluent profile outrank a Polyglot one, however the rotation falls', () => {
    for (let bucket = BUCKET; bucket < BUCKET + 200; bucket++) {
      const at = new Date(bucket * HOUR)
      const fluentAndHere = candidate('fluent', 'pro', 0, at)
      const polyglotAndGone = candidate('polyglot', 'pro_plus', 365 * DAY, at)
      expect(leader([fluentAndHere, polyglotAndGone], 'viewer', at), `bucket ${bucket}`).toBe(
        'polyglot',
      )
    }
  })

  it('leads with the subscriber who was here this week, whatever the rotation falls', () => {
    for (let bucket = BUCKET; bucket < BUCKET + 200; bucket++) {
      const at = new Date(bucket * HOUR)
      const here = candidate('here', 'pro_plus', DAY, at)
      const dormant = candidate('dormant', 'pro_plus', 30 * DAY, at)
      expect(leader([here, dormant], 'viewer', at), `bucket ${bucket}`).toBe('here')
    }
  })

  /**
   * Pins which side of the cut is which. An inverted comparison would put the
   * dormant subscriber in front and no other test here would notice, because
   * the two bands are otherwise symmetrical.
   */
  it('counts the last moment of the week as here, and the one after it as dormant', () => {
    const inside = candidate('inside', 'pro_plus', DISCOVERY_BOOSTED_FRESH_MS - 1)
    const outside = candidate('outside', 'pro_plus', DISCOVERY_BOOSTED_FRESH_MS + 1)
    expect(leader([outside, inside], 'viewer', AT)).toBe('inside')
  })

  /**
   * "The cards do not move when I pull to refresh." The strip is refetched on
   * every mount and focus, so an order that changed per request would look
   * like a bug long before it looked fair.
   */
  it('gives one viewer the same order for every instant inside a rotation window', () => {
    const people = [
      candidate('a', 'pro_plus', HOUR),
      candidate('b', 'pro_plus', HOUR),
      candidate('c', 'pro_plus', HOUR),
    ]
    const start = orderBoosted(people, 'viewer', AT).map((p) => p._id)

    for (const offset of [1, HOUR / 2, HOUR - 1]) {
      const later = orderBoosted(people, 'viewer', new Date(AT.getTime() + offset))
      expect(
        later.map((p) => p._id),
        `offset ${offset}`,
      ).toEqual(start)
    }

    const nextHour = orderBoosted(people, 'viewer', new Date(AT.getTime() + HOUR))
    expect(nextHour.map((p) => p._id).toSorted()).toEqual(start.toSorted())
  })

  it('moves every candidate through the lead across a day of rotations', () => {
    const people = ['a', 'b', 'c', 'd'].map((id) => candidate(id, 'pro_plus', HOUR))
    const leaders = new Set<string>()
    for (let bucket = BUCKET; bucket < BUCKET + 24; bucket++) {
      leaders.add(leader(people, 'viewer', new Date(bucket * HOUR)))
    }
    expect(leaders.size).toBe(4)
  })

  /**
   * The one that matters at this size. A single person opens the app a couple
   * of times a day, so they see very few buckets — if the seed were time
   * alone, a subscriber would wait a week to be seen once. The viewer term is
   * what makes somebody's strip lead them *today*.
   */
  it('spreads the lead across viewers inside a single rotation window', () => {
    const people = ['a', 'b', 'c', 'd'].map((id) => candidate(id, 'pro_plus', HOUR))
    const led = new Map<string, number>()
    const viewers = 200
    for (let i = 0; i < viewers; i++) {
      const winner = leader(people, `viewer-${i}`, AT)
      led.set(winner, (led.get(winner) ?? 0) + 1)
    }
    for (const person of people) {
      // A quarter each is the expectation; a tenth is the floor that still
      // fails a seed which ignores the viewer, and that is what it is for.
      expect(led.get(person._id) ?? 0, person._id).toBeGreaterThan(viewers / 10)
    }
  })

  it('returns the candidates it was given, and leaves the array it was handed alone', () => {
    const people = ['a', 'b', 'c'].map((id) => candidate(id, 'pro_plus', HOUR))
    const asHanded = [...people]

    const ordered = orderBoosted(people, 'viewer', AT)

    expect(ordered).toHaveLength(3)
    expect(ordered.map((p) => p._id).toSorted()).toEqual(['a', 'b', 'c'])
    expect(people).toEqual(asHanded)
  })

  it('answers an empty strip with an empty list', () => {
    expect(orderBoosted([], 'viewer', AT)).toEqual([])
  })
})
