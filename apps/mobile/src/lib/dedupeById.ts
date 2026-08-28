/**
 * First occurrence wins.
 *
 * Keyset cursors are only stable while the sort key is: pagination over
 * `lastMessage.createdAt` or `stats.lastActiveAt` can hand back a row already
 * seen on an earlier page, because the row moved between the two requests.
 * That is not a bug to fix on the server — the alternative is a snapshot —
 * but a duplicate `key` in a FlatList is a warning plus a row React will
 * never update.
 */
export function dedupeById<T extends { _id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item._id)) return false
    seen.add(item._id)
    return true
  })
}
