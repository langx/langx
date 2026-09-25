import type { Query, QueryClient } from '@tanstack/react-query'
import { firstPageOnly, trimsWhenUnwatched } from './queryPersistence'

/**
 * A thread that no screen is showing keeps its newest page only.
 *
 * The client's `gcTime` is a week now, to match the persisted cache (see
 * `createQueryClient`), and that changed what leaving a thread costs. At five
 * minutes a thread you had scrolled back through was collected soon after
 * you left it, and reopening it fetched one page behind a skeleton. At a week
 * every page stays, and reopening a stale thread refetches **all** of them in
 * sequence — ten requests to redraw a screen that shows the newest thirty
 * messages first. The skeleton was fixed by paying for it in round trips.
 *
 * Cutting to one page loses nothing a reader can see: a thread opens at its
 * newest message, whatever was loaded behind it, and the older pages come
 * back as they did the first time, on the scroll that asks for them. It is
 * also what bounds the memory a week-long `gcTime` would otherwise let a
 * heavy account build up, since threads are the only cache that grows by
 * scrolling.
 *
 * Only live threads. The chat list's tabs are one hook whose key changes with
 * the segment, so cutting the tab you just left would scroll it back to the
 * top when you return; the jump window has its own sixty-second life.
 *
 * Two moments: the last screen leaving, and new data landing while none is
 * there — a refetch that was in flight when the screen went, which would
 * otherwise put every page back. `updatedAt` and the invalidation are carried
 * over, so the cut changes the page count and nothing about freshness.
 *
 * Returns the unsubscribe for completeness; the app's client lives as long as
 * the app does, and nothing calls it.
 */
export function keepUnwatchedThreadsShort(queryClient: QueryClient): () => void {
  const trim = (query: Query): void => {
    if (query.getObserversCount() > 0) return
    if (!trimsWhenUnwatched(query.queryKey)) return
    const { data, dataUpdatedAt, isInvalidated } = query.state
    const trimmed = firstPageOnly(data)
    if (trimmed === data) return
    queryClient.setQueryData(query.queryKey, trimmed, { updatedAt: dataUpdatedAt })
    // `setQueryData` marks the query valid; one that was due a refetch still is.
    if (isInvalidated) {
      void queryClient.invalidateQueries({
        queryKey: query.queryKey,
        exact: true,
        refetchType: 'none',
      })
    }
  }

  return queryClient.getQueryCache().subscribe((event) => {
    // The cache types every query it announces with `any` parameters; this
    // reads nothing that depends on them.
    const query = event.query as Query
    if (event.type === 'observerRemoved') trim(query)
    else if (event.type === 'updated' && event.action.type === 'success') trim(query)
  })
}
