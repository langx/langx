import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { hydrate, type QueryClient } from '@tanstack/react-query'
import {
  persistQueryClientSubscribe,
  type PersistedClient,
} from '@tanstack/react-query-persist-client'
import { useEffect } from 'react'
import {
  PERSIST_THROTTLE_MS,
  QUERY_CACHE_VERSION,
  isRestorable,
  parsePersistedClient,
  persistedCacheKey,
  serializePersistedClient,
  shouldPersistQuery,
} from '../lib/queryPersistence'
import { openQueryStorage } from '../lib/queryStorage'

/**
 * Keeps the query cache on the device, one file per account, and restores it
 * the moment that account is known.
 *
 * **At the root, not in `(app)/_layout`.** The first screen that wants the
 * cache is `app/index.tsx`, the gate that reads `me` to decide between
 * onboarding and the tabs — and it sits above the app layout. Restored there,
 * the gate passes on the stored profile before the network answers. On a
 * phone that includes a cold start in a tunnel: `@better-auth/expo` restores
 * the session from secure storage without a request, so the account id — and
 * with it this restore — does not wait for a network either.
 *
 * **Restored by hand rather than through `PersistQueryClientProvider` or
 * `persistQueryClient`.** The provider restores when it mounts, and at the
 * root the account is not known at mount. The helper can be told to stop
 * subscribing, but not to stop a restore already reading: a sign-out that
 * lands during the read would run `queryClient.clear()`, and the read would
 * then hydrate the previous account's rows into the emptied cache — the exact
 * leak the account-switch effect exists to prevent. Here the cancelled check
 * and `hydrate` run in one synchronous step, so nothing can come between them.
 *
 * Screens that mount before the read lands start their fetches as they always
 * did. `hydrate` writes stored data only over a query that has none newer, so
 * it fills a request still in flight and never overwrites an answer.
 *
 * **Declared after the account-switch effect in `RootShell`, deliberately.**
 * React runs every cleanup of a commit before any effect body, then the
 * bodies in declaration order; on a switch from A to B that ends A's
 * subscription, then clears the cache and deletes A's file, then starts B's
 * restore. Declared the other way round, B's restore would begin a beat before
 * the clear that is meant to precede it.
 *
 * Nothing here throws out, and nothing waits on it: a device that cannot read
 * or write the file behaves exactly as the app did before this existed.
 */
export function usePersistedQueries(queryClient: QueryClient, userId: string | undefined): void {
  useEffect(() => {
    if (!userId) return
    const storage = openQueryStorage()
    if (!storage) return

    const persister = createAsyncStoragePersister({
      storage,
      key: persistedCacheKey(userId),
      throttleTime: PERSIST_THROTTLE_MS,
      serialize: serializePersistedClient,
      // The parse checks the envelope and nothing inside it: what is inside
      // was written by `serializePersistedClient` from a real client state.
      deserialize: (raw) => parsePersistedClient(raw) as PersistedClient,
    })

    let cancelled = false
    let unsubscribe: (() => void) | undefined

    void (async () => {
      try {
        const stored = await persister.restoreClient()
        if (cancelled) return
        if (stored && isRestorable(stored, Date.now())) hydrate(queryClient, stored.clientState)
        else if (stored) await persister.removeClient()
      } catch {
        // Half-written by a kill, or from a build that wrote something else.
        // Nobody to tell: start empty, as a first launch would.
        await persister.removeClient()
      }
      if (cancelled) return
      unsubscribe = persistQueryClientSubscribe({
        queryClient,
        persister,
        buster: QUERY_CACHE_VERSION,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => shouldPersistQuery(query),
          // Unsent messages are `unsentStore.ts`'s to keep, in a shape the chat
          // screen can retry; a restored mutation has no function to run.
          shouldDehydrateMutation: () => false,
        },
      })
    })()

    return () => {
      cancelled = true
      unsubscribe?.()
      // After the unsubscribe, so the throttle's trailing write — which the
      // unsubscribe cannot cancel — finds a storage that no longer writes.
      storage.close()
    }
  }, [queryClient, userId])
}

/**
 * Deletes one account's stored cache. Called from the account-switch effect
 * beside `queryClient.clear()`, which is the one place that already knows
 * which account has just left.
 */
export async function forgetPersistedQueries(userId: string): Promise<void> {
  await openQueryStorage()?.removeItem(persistedCacheKey(userId))
}
