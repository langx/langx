/**
 * Keeps each message the same object for as long as it has not changed, so a
 * memoised bubble given it compares equal and does not render again.
 *
 * TanStack's structural sharing already does this — but by position. A
 * thread is a sliding window: a refetch after a message lands (the read event
 * invalidates the thread) returns the newest page with everything moved along
 * by one, and every index then holds a different message than it did. Each
 * comparison fails, every message comes back a new object, and every bubble
 * on screen renders for the one that arrived. Matching by id instead makes the
 * arrival cost one row.
 *
 * Pure, and free of `react-native`, so vitest can load it.
 */
export function keepIdentity<T extends { _id: string }>(
  previous: ReadonlyMap<string, T>,
  next: readonly T[],
): { items: T[]; byId: Map<string, T> } {
  const byId = new Map<string, T>()
  const items = next.map((message) => {
    const before = previous.get(message._id)
    const kept = before !== undefined && sameValue(before, message) ? before : message
    byId.set(message._id, kept)
    return kept
  })
  return { items, byId }
}

/** Deep equality over what JSON can carry, which is all a message is. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => sameValue(value, b[index]))
  }
  const left = a as Record<string, unknown>
  const right = b as Record<string, unknown>
  const keys = Object.keys(left)
  if (keys.length !== Object.keys(right).length) return false
  return keys.every(
    (key) => Object.prototype.hasOwnProperty.call(right, key) && sameValue(left[key], right[key]),
  )
}
