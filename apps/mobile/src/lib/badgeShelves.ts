import type { BadgeKind, EarnedBadge } from '@langx/shared'

/**
 * The v3 badge screen as data: one shelf per family, each holding the whole
 * ladder in order of its thresholds.
 *
 * Each rung is in one of three states. **Earned**; the one **next** rung,
 * whose border is stitched as far as the family's progress has got; and
 * **locked**, every rung above that, drawn as a pencil pattern. A family the
 * server sends no progress for (somebody else's shelf, or a cohort) has no
 * next rung — its unearned rungs are simply locked.
 */
export type RungState = 'earned' | 'next' | 'locked'

export interface Rung {
  badge: EarnedBadge
  state: RungState
  /** Where the family stands on its own scale; `null` when the server did not say. */
  current: number | null
  /** Earned and not yet seen on this device — see `useNewBadges`. */
  isNew: boolean
}

export interface Shelf {
  kind: BadgeKind
  rungs: Rung[]
  earned: number
  hasNew: boolean
}

/**
 * The shelves, in the order the screen draws them.
 *
 * **Shelves holding a new badge first**, because that is what somebody opens
 * the page to look at; **then by how far up the ladder they are**, so the
 * families somebody is actually climbing come before the ones they have not
 * started; ties keep the catalogue's order, which is the order `badges`
 * arrived in. A family with nothing earned sorts by its next rung's fraction
 * among the other empty ones, so the one closest to a first badge leads.
 */
export function badgeShelves(
  badges: readonly EarnedBadge[],
  progress: Readonly<Record<string, number>> | undefined,
  newIds: ReadonlySet<string>,
): Shelf[] {
  const byKind = new Map<BadgeKind, EarnedBadge[]>()
  for (const badge of badges) {
    const list = byKind.get(badge.kind) ?? []
    list.push(badge)
    byKind.set(badge.kind, list)
  }

  const shelves: { shelf: Shelf; order: number; fraction: number }[] = []
  let order = 0
  for (const [kind, list] of byKind) {
    const sorted = [...list].sort((a, b) => a.threshold - b.threshold)
    const current = progress?.[kind] ?? null
    let nextGiven = false
    const rungs: Rung[] = sorted.map((badge) => {
      let state: RungState = 'locked'
      if (badge.earned) state = 'earned'
      else if (current !== null && !nextGiven) {
        state = 'next'
        nextGiven = true
      }
      return { badge, state, current, isNew: badge.earned && newIds.has(badge.id) }
    })
    const earned = rungs.filter((rung) => rung.state === 'earned').length
    const next = rungs.find((rung) => rung.state === 'next')
    const nextFraction =
      next && current !== null ? Math.min(1, current / Math.max(1, next.badge.threshold)) : 0
    shelves.push({
      shelf: { kind, rungs, earned, hasNew: rungs.some((rung) => rung.isNew) },
      order: order++,
      // Earned rungs count whole; the next one counts by how close it is.
      fraction: (earned + nextFraction) / Math.max(1, rungs.length),
    })
  }

  return shelves
    .sort((a, b) => {
      if (a.shelf.hasNew !== b.shelf.hasNew) return a.shelf.hasNew ? -1 : 1
      if (a.fraction !== b.fraction) return b.fraction - a.fraction
      return a.order - b.order
    })
    .map(({ shelf }) => shelf)
}

/** The rung of a shelf that `id` names, and its 1-based place on the ladder. */
export function rungOf(
  shelves: readonly Shelf[],
  id: string,
): { shelf: Shelf; rung: Rung; position: number } | null {
  for (const shelf of shelves) {
    const index = shelf.rungs.findIndex((rung) => rung.badge.id === id)
    if (index >= 0) return { shelf, rung: shelf.rungs[index]!, position: index + 1 }
  }
  return null
}

/** What the v3 shelf offers to do about a badge still to earn. */
export type BadgeAction = 'correct' | 'write' | 'echo'

/**
 * The button under a badge still to earn: where it is earned, or `null` when
 * nothing done by a press brings it closer (the days a member, the v1
 * cohort).
 *
 * Unlike `nextBadgeAction` on Me, the streak has one: practising in Echo is
 * the plainest way to keep today's day, and the drawing puts it there.
 */
export function badgeAction(kind: BadgeKind): BadgeAction | null {
  const actions: Record<BadgeKind, BadgeAction | null> = {
    streak: 'echo',
    correction: 'correct',
    messages: 'write',
    tokens: 'write',
    veteran: null,
    origin: null,
    languages: 'echo',
    calls: 'write',
    echo: 'echo',
    // Somebody else writes these; nothing a press does brings one closer.
    testimonials: null,
    guide: 'correct',
    openers: 'write',
  }
  return actions[kind]
}

/** How far the next rung's border is stitched, 0 to 1. */
export function rungProgress(rung: Rung): number {
  if (rung.state !== 'next' || rung.current === null) return 0
  return Math.max(0, Math.min(1, rung.current / Math.max(1, rung.badge.threshold)))
}
