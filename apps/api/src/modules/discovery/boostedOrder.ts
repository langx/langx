import { createHash } from 'node:crypto'
import {
  DISCOVERY_BOOSTED_FRESH_MS,
  DISCOVERY_BOOSTED_ROTATION_MS,
  DISCOVERY_BOOSTED_TIERS,
  type PlanTier,
} from '@langx/shared'

/**
 * What the ordering needs to know about a candidate.
 *
 * Structural rather than `Profile`, so the tests can pass three-field literals
 * and the call site can hand over documents without a mapping pass.
 */
export interface BoostedCandidate {
  _id: string
  entitlement: { tier: PlanTier }
  stats: { lastActiveAt: Date }
}

/**
 * A rotation value for one viewer, one profile and one hour.
 *
 * SHA-256 rather than the small `Math.imul` generator `gift.test.ts` uses:
 * that one is seeded by a single number, and seeding it from three strings
 * would mean first writing a folding hash and then having to argue its
 * avalanche behaviour. `node:crypto` is already how this codebase hashes a
 * string, and thirty-two bits off the front of a digest is all an order needs.
 */
function rotationOf(viewerId: string, candidateId: string, bucket: number): number {
  return createHash('sha256')
    .update(`${viewerId}:${candidateId}:${bucket}`)
    .digest()
    .readUInt32BE(0)
}

/**
 * The strip's presentation order, for one viewer at one moment.
 *
 * Three bands, outermost first, and only the third is new:
 *
 * 1. **Tier.** Polyglot above Fluent, always. The paywall sells that sentence
 *    and `rules.test.ts` pins the list it comes from, so it is a hard band and
 *    nothing below it may cross one.
 * 2. **Seen this week, or not.** This replaces ordering by `lastActiveAt`
 *    outright. A continuous ladder over a handful of candidates is a permanent
 *    order — the same profile leads every impression for as long as it keeps
 *    opening the app — and mutual language fit keeps those candidate sets to a
 *    few people, of whom only the first two or three are ever on screen. One
 *    coarse cut keeps a dormant subscriber off the front without handing the
 *    front to one account.
 * 3. **Rotation**, seeded on the viewer, the profile and the hour. The viewer
 *    is in the seed for the reason that matters at this size: one person sees
 *    very few hours in a day, so if the seed were time alone the exposure
 *    would only even out over a week. With the viewer in it, a subscriber is
 *    leading somebody's strip within the hour.
 *
 * `_id` is the last term and is not decoration: two equal hashes would
 * otherwise leave the result to the engine's sort, and "the cards do not move
 * when I pull to refresh" would stop being true for reasons nobody could
 * reproduce.
 *
 * `now` carries both the freshness cutoff and the rotation bucket, so this has
 * no clock of its own and a test can ask for any hour it likes.
 */
export function orderBoosted<T extends BoostedCandidate>(
  candidates: readonly T[],
  viewerId: string,
  now: Date,
): T[] {
  const freshFrom = now.getTime() - DISCOVERY_BOOSTED_FRESH_MS
  const bucket = Math.floor(now.getTime() / DISCOVERY_BOOSTED_ROTATION_MS)

  // Decorated once per candidate rather than inside the comparator, which
  // would hash O(n log n) times for an answer that cannot change.
  const ranked = candidates.map((candidate) => ({
    candidate,
    // `-1` is unreachable: the pipeline's `$match` admits these tiers only.
    tier: DISCOVERY_BOOSTED_TIERS.findIndex((tier) => tier === candidate.entitlement.tier),
    dormant: candidate.stats.lastActiveAt.getTime() < freshFrom ? 1 : 0,
    rotation: rotationOf(viewerId, candidate._id, bucket),
  }))

  return ranked
    .toSorted(
      (a, b) =>
        a.tier - b.tier ||
        a.dormant - b.dormant ||
        a.rotation - b.rotation ||
        (a.candidate._id < b.candidate._id ? -1 : a.candidate._id > b.candidate._id ? 1 : 0),
    )
    .map((entry) => entry.candidate)
}
