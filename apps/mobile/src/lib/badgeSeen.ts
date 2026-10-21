/**
 * Which earned badges this device has already shown somebody, so a badge is
 * **New** — and celebrated — exactly once.
 *
 * On the device, not the account. The evening round-up already tells the
 * account (`stats.notifiedBadgeIds`, the bell row, push and email); this is
 * only about the patch being looked at, and a second phone showing it once
 * more is the cheap failure. Kept per account, so a shared phone does not
 * hand one person's "New" to the next.
 *
 * **The first reading seeds, it does not celebrate.** With nothing stored,
 * every badge already earned is recorded as seen, except those of the
 * families in `ARRIVING_KINDS`: a person opening the v3 shelf for the first
 * time has a hundred corrections they already know about, and only the
 * families that did not exist before are news. Those arrive marked New, and
 * the one at the top of them is celebrated.
 */
import type { BadgeKind, EarnedBadge } from '@langx/shared'

/**
 * Families new with the v3 shelf: counted back through what somebody had
 * already done, so on the first day they are news. Empty until the server
 * sends them.
 */
export const ARRIVING_KINDS: ReadonlySet<BadgeKind> = new Set<BadgeKind>([])

export interface SeenRecord {
  userId: string
  ids: string[]
}

/** The ids earned and not yet seen, given what is stored (or `null` for nothing). */
export function unseenIds(
  stored: SeenRecord | null,
  userId: string,
  earned: readonly EarnedBadge[],
): { fresh: string[]; seed: string[] | null } {
  if (!stored || stored.userId !== userId) {
    const seed = earned.filter((badge) => !ARRIVING_KINDS.has(badge.kind)).map((b) => b.id)
    const fresh = earned.filter((badge) => ARRIVING_KINDS.has(badge.kind)).map((b) => b.id)
    return { fresh, seed }
  }
  const known = new Set(stored.ids)
  return { fresh: earned.filter((badge) => !known.has(badge.id)).map((b) => b.id), seed: null }
}

/**
 * The one badge to celebrate out of several new ones: the last of them in
 * catalogue order, which within a ladder is its highest rung — a ladder
 * climbed three rungs at once is best told by its top one. The others keep
 * their New mark on the shelf.
 */
export function celebrated(
  earned: readonly EarnedBadge[],
  fresh: readonly string[],
): EarnedBadge | null {
  const set = new Set(fresh)
  return earned.filter((badge) => set.has(badge.id)).at(-1) ?? null
}
