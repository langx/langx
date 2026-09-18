import type { EarnedBadge } from '@langx/shared'

/**
 * The badges you have, then the ones you do not.
 *
 * `BADGES` is a catalogue and is ordered as one — cohort badges, then each
 * ladder from its first rung — which is the right order for a list of what
 * there is to earn and the wrong one for a page somebody opens to look at what
 * they did. With three badges out of twenty-five, the catalogue order buries
 * all three behind a screenful of "Locked" and the answer to "what have I got"
 * takes scrolling to find.
 *
 * Within each half the catalogue order survives, which is the whole reason
 * this is a partition rather than a sort on anything richer. `Array.sort` is
 * stable, so the earned badges keep the order they were sent in and so do the
 * locked ones — including the nearest one, which is the first locked row in
 * every case where the ladder above it has been climbed in order.
 *
 * Not sorted by date: `earnedAt` is null for four of the six kinds (nothing
 * records which correction was the thousandth), so dating the shelf would sink
 * most of it under the two kinds that happen to know.
 */
export function badgesEarnedFirst(badges: readonly EarnedBadge[]): EarnedBadge[] {
  return [...badges].sort((a, b) => Number(b.earned) - Number(a.earned))
}
