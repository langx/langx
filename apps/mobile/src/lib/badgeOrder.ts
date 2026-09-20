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

/**
 * Two rows per kind: **where you are, and what is next.**
 *
 * A ladder used to arrive whole — first correction, ten, a hundred, and the
 * four locked rungs above them — which is seven rows to say one thing. The
 * rungs below the top are a history, and a history of a number that only goes
 * up is already implied by the number itself: nobody holding "1,000
 * corrections" is wondering whether they passed ten.
 *
 * So each kind keeps its **highest earned** rung and its **lowest unearned**
 * one, and the page goes from twenty-five rows to about ten. The pair reads as
 * a sentence — here, then there — which is what the screen was for.
 *
 * The lowest unearned rung is also always the one `next` can name: "nearest"
 * is by fraction of the way there, and within a kind that is whichever rung
 * comes first. So the progress fraction never lands on a row this drops.
 *
 * Thresholds decide, not the order the badges arrive in. Reading the tips off
 * the array's ends would be right only for a caller who passed the catalogue
 * in its own order, which is a precondition nothing here states — the same
 * reason `badgeStripMarks` does its own sorting.
 *
 * Their shelf holds no locked rows at all, so there this is the strip's rule
 * by another route: one mark per kind, the top one.
 */
export function badgeLadderTips(badges: readonly EarnedBadge[]): EarnedBadge[] {
  const tips = new Map<string, EarnedBadge>()
  for (const badge of badges) {
    // Keyed by state as well as kind, so a kind's earned tip and its locked
    // one never compete for the same slot.
    const key = `${badge.kind}:${String(badge.earned)}`
    const held = tips.get(key)
    const beats = badge.earned
      ? !held || badge.threshold > held.threshold
      : !held || badge.threshold < held.threshold
    if (beats) tips.set(key, badge)
  }

  const keep = new Set([...tips.values()].map((badge) => badge.id))
  return badges.filter((badge) => keep.has(badge.id))
}
