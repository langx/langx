import type { EarnedBadge } from '@langx/shared'
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { unseenIds, type SeenRecord } from '../lib/badgeSeen'
import { FLAG_KEYS, readJsonFlag, writeJsonFlag } from '../lib/localFlags'

/*
 * One copy of the stored record for the whole app, so the shelf and the
 * earned sheet agree the moment either marks a badge seen. `undefined` until
 * the first read has come back, and nothing is New before then: a flash of
 * New marks that vanish a frame later would be worse than none.
 */
let record: SeenRecord | null | undefined
let loading: Promise<void> | null = null
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function load(): void {
  if (record !== undefined || loading) return
  loading = readJsonFlag<SeenRecord>(FLAG_KEYS.badgesSeen)
    .then((stored) => {
      record = stored && Array.isArray(stored.ids) ? stored : null
    })
    .catch(() => {
      record = null
    })
    .finally(() => {
      loading = null
      emit()
    })
}

function save(next: SeenRecord): void {
  record = next
  emit()
  void writeJsonFlag(FLAG_KEYS.badgesSeen, next)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const snapshot = () => record

/**
 * The earned badges not yet seen on this device, and a way to mark them
 * seen. See `lib/badgeSeen.ts` for the rule, including the first reading,
 * which records what was already earned rather than celebrating all of it.
 */
export function useNewBadges(
  userId: string | undefined,
  badges: readonly EarnedBadge[] | undefined,
): { fresh: ReadonlySet<string>; markSeen: (ids: readonly string[]) => void } {
  const stored = useSyncExternalStore(subscribe, snapshot, snapshot)
  useEffect(load, [])

  const earned = useMemo(() => (badges ?? []).filter((badge) => badge.earned), [badges])
  const result = useMemo(
    // Nothing is decided before both the record and the badges are in: a
    // seed written from an empty list would mark everything after it New.
    () => (stored === undefined || !userId || !badges ? null : unseenIds(stored, userId, earned)),
    [stored, userId, badges, earned],
  )

  // The first reading for this account writes what is already known.
  useEffect(() => {
    if (result?.seed && userId) save({ userId, ids: result.seed })
  }, [result, userId])

  const markSeen = useCallback(
    (ids: readonly string[]) => {
      if (!userId || ids.length === 0) return
      const current = record && record.userId === userId ? record.ids : []
      const merged = [...new Set([...current, ...ids])]
      if (merged.length !== current.length) save({ userId, ids: merged })
    },
    [userId],
  )

  const fresh = useMemo(() => new Set(result?.fresh ?? []), [result])
  return { fresh, markSeen }
}
