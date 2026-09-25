/**
 * What of the query cache goes to disk, and in what shape.
 *
 * Every screen in this app reads its data through TanStack Query, and until
 * now that cache lived in memory alone. A cold start therefore drew every list
 * as skeletons, and the chat list followed each row with a profile request of
 * its own; a thread left for five minutes was garbage-collected and drew six
 * skeleton bubbles when reopened. The cache is now written to the device and
 * restored at the next launch, so the first frame of every screen is the last
 * thing it showed — stale, marked so, and refetched behind the first paint.
 *
 * The rules live here, apart from the writing (`queryStorage.ts`) and the
 * wiring (`hooks/usePersistedQueries.ts`), because `src/lib` is the only
 * directory vitest can load. Nothing here imports TanStack: the shapes are
 * described structurally so the module stays a few pure functions.
 */

/**
 * Bump when a persisted DTO changes shape in a way the screens cannot survive
 * for one round trip. A mismatch throws the whole stored cache away.
 *
 * Deliberately **not** the OTA update id or the web build hash: every merge to
 * `main` publishes both, several times a day, and a cache keyed to them would
 * rarely live long enough to be worth writing. Forgetting to bump is bounded
 * by `persistableState` below: everything restored is marked invalidated, so
 * the first screen to read it refetches it, and an old shape is on screen for
 * one round trip at most — the window every screen already tolerates while a
 * JS update runs ahead of the API deploy behind it.
 */
export const QUERY_CACHE_VERSION = '1'

/** How old a stored cache may be before it is discarded rather than restored. */
export const PERSIST_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * The gap between two writes. The whole trimmed cache is serialised on every
 * write, so during an active chat this is what keeps the JS thread free.
 */
export const PERSIST_THROTTLE_MS = 5_000

/**
 * The ceiling on the serialised cache, in characters.
 *
 * Not a storage limit — a file in the cache directory and an IndexedDB row can
 * both hold far more — but a *serialisation* budget: every write stringifies
 * the whole thing, and two megabytes is where that stays around a frame on a
 * mid-range Android. Newest queries are kept first, so what falls off the end
 * is what was fetched longest ago.
 */
export const PERSIST_BUDGET_CHARS = 2_000_000

/**
 * Prefixes that never go to disk, whatever their `gcTime`.
 *
 * - `app-config`: the gate that decides whether the app runs at all. A stored
 *   `updateRequired` would lock out the very binary that answered it, and a
 *   stored maintenance window would keep a phone in a tunnel on the
 *   maintenance screen until it found a network. No config is the documented
 *   fallback (`useAppConfig`); a stale one is not.
 * - `admin`: the operator panel reads other people's records and must be
 *   fresh; nothing of it belongs on a phone between sessions.
 * - `echo`: the review queue is deliberately uncached (`gcTime: 0`, see
 *   `useEchoQueue`) and the offline story is `echoStore.ts`'s own snapshot,
 *   which already holds the pending grades this cache never could.
 * - `suspension`: the one query that still answers while the rest of the app
 *   is refused, and the one whose answer must never be yesterday's.
 * - `handleSearch`, `handle-availability`, `cities`, `linkPreview`: keystroke
 *   results and page metadata. Cheap to ask again, and "that handle is free"
 *   from last week is the kind of stale that gets somebody refused.
 */
const NEVER_PERSISTED_PREFIXES = new Set([
  'admin',
  'app-config',
  'echo',
  'suspension',
  'handleSearch',
  'handle-availability',
  'cities',
  'linkPreview',
])

/**
 * How many queries of one prefix survive a write, newest first.
 *
 * `messages` holds one entry per thread ever opened and `profile` one per
 * person ever seen in a list, so those two are where a heavy account's cache
 * would grow without a ceiling. `discovery` keys on the serialised filter set,
 * and every filter change is a new key that nobody comes back to.
 */
const PREFIX_CAPS: Record<string, number> = {
  messages: 40,
  profile: 200,
  discovery: 10,
}
const DEFAULT_PREFIX_CAP = 50

export interface PersistedQueryState {
  data?: unknown
  dataUpdatedAt: number
  status?: string
}

/** The slice of TanStack's `DehydratedQuery` these rules read. */
export interface PersistedQueryLike {
  queryKey: readonly unknown[]
  state: PersistedQueryState
}

/** The slice of TanStack's `PersistedClient` these rules read. */
export interface PersistedClientLike<Q extends PersistedQueryLike = PersistedQueryLike> {
  timestamp: number
  buster: string
  clientState: {
    mutations?: readonly unknown[]
    queries: readonly Q[]
  }
}

/**
 * Where one account's cache lives, apart from every other account's.
 *
 * A key per user rather than one key with the user written inside it, because
 * the second design has to be *read* before it can be refused — and the moment
 * between restoring the file and learning who is signed in is exactly the
 * moment a screen could paint somebody else's rows. With a key per user there
 * is nothing to refuse: the next account restores a file that does not exist.
 *
 * The id is reduced to the characters a file name is safe with; Better Auth's
 * ids are hex already, so this changes nothing today and stops a surprise.
 */
export function persistedCacheKey(userId: string): string {
  return `queries-${userId.replace(/[^A-Za-z0-9_-]/g, '_')}`
}

/**
 * Whether one query is worth writing at all.
 *
 * **Anything with data**, not only a `success`. TanStack's default filter
 * keeps successes, and a list whose background refetch timed out is an
 * `error` that still holds every row — so one captive portal would have
 * deleted the chat list from disk at the next write, which is the moment it
 * was needed. `persistableState` writes it back as the success it was.
 *
 * The last test is the one that keeps the deny-list short: a query whose own
 * `gcTime` is shorter than the cache's `maxAge` was given that short life on
 * purpose — the jump window's sixty seconds, the Echo queue's zero — and
 * TanStack would collect it before the stored copy could ever be read.
 * Persist only what the client itself would still be holding, and every
 * deliberately short-lived cache excludes itself without a line here.
 *
 * `messagesAround` is named all the same. Its exclusion is not a performance
 * choice: a jump window is a slice out of the middle of a thread, and the
 * socket's incoming-message writer walks the `['messages', id]` prefix — a
 * restored window would be on the wrong side of `pages[0]`-is-newest.
 */
export function shouldPersistQuery(
  query: { queryKey: readonly unknown[]; gcTime: number; state: { data?: unknown } },
  maxAge: number = PERSIST_MAX_AGE_MS,
): boolean {
  if (query.state.data === undefined) return false
  const [head] = query.queryKey
  if (typeof head !== 'string') return false
  if (NEVER_PERSISTED_PREFIXES.has(head)) return false
  if (head === 'messages' && query.queryKey[2] === 'around') return false
  return query.gcTime >= maxAge
}

/** Whether a stored cache may be restored: this version's, and young enough. */
export function isRestorable(
  client: Pick<PersistedClientLike, 'timestamp' | 'buster'>,
  now: number,
  maxAge: number = PERSIST_MAX_AGE_MS,
): boolean {
  return client.buster === QUERY_CACHE_VERSION && now - client.timestamp <= maxAge
}

interface InfiniteDataLike {
  pages: readonly unknown[]
  pageParams: readonly unknown[]
}

function isInfiniteData(data: unknown): data is InfiniteDataLike {
  if (!data || typeof data !== 'object') return false
  const candidate = data as Partial<InfiniteDataLike>
  return Array.isArray(candidate.pages) && Array.isArray(candidate.pageParams)
}

/**
 * An infinite query's data cut to its first page, `pageParams` in step.
 *
 * The identical value back when there is nothing to cut — a plain query, or a
 * single page — so a caller can compare by reference and skip a write that
 * would change nothing.
 */
export function firstPageOnly<T>(data: T): T {
  if (!isInfiniteData(data) || data.pages.length <= 1) return data
  return { ...data, pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) }
}

/**
 * Whether a query should be cut back to one page the moment no screen shows
 * it. Only a live thread: see `queryLifetimes.ts` for why.
 */
export function trimsWhenUnwatched(queryKey: readonly unknown[]): boolean {
  return queryKey[0] === 'messages' && queryKey[2] !== 'around'
}

/**
 * The state as it should come back: an answer, marked stale.
 *
 * `isInvalidated` is what makes "restored" mean "refetched on first read"
 * whatever the query's `staleTime`. Without it a launch within thirty seconds
 * of the last write would trust what is on disk — and a push tapped from a
 * cold start would open a thread without the message the push was about,
 * which is the bug `missedEvents.ts` exists for, back by a different door.
 * The one TanStack read that skips it is `staleTime: 'static'`, which nothing
 * in this app uses.
 *
 * An `error` with data is written as the success it was before the refetch
 * failed; the error object itself is an `ApiRequestError` that JSON would
 * flatten into something no screen could branch on.
 */
function persistableState<S extends PersistedQueryState>(state: S): S {
  return {
    ...state,
    ...(state.status === 'error' && {
      status: 'success',
      error: null,
      fetchFailureCount: 0,
      fetchFailureReason: null,
    }),
    fetchStatus: 'idle',
    fetchMeta: null,
    isInvalidated: true,
  }
}

/**
 * The cache cut down to what is worth restoring.
 *
 * **First page only** for every infinite query. A refetch of an infinite query
 * fetches every loaded page in sequence and everything restored is refetched,
 * so ten restored pages would be ten requests before a list is current — the
 * very cost `useSocket` refuses to pay per message. One page is one request,
 * and the reader scrolls for the rest exactly as they did the first time.
 *
 * Then newest first, a cap per prefix, and a budget over the whole. Queries
 * whose data is `undefined` are dropped: there is nothing to restore.
 *
 * Mutations are never written. The only ones worth keeping across a launch are
 * unsent messages, and `unsentStore.ts` already holds those in a shape the
 * chat screen knows how to retry.
 */
export function trimPersistedClient<Q extends PersistedQueryLike>(
  client: PersistedClientLike<Q>,
  budget: number = PERSIST_BUDGET_CHARS,
): { client: PersistedClientLike<Q>; serializedQueries: string[] } {
  const candidates = client.clientState.queries
    .filter((query) => query.state.data !== undefined)
    .map((query) => ({
      ...query,
      state: persistableState({ ...query.state, data: firstPageOnly(query.state.data) }),
    }))
    .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)

  const seen = new Map<string, number>()
  const kept: Q[] = []
  const serializedQueries: string[] = []
  let used = 0
  for (const query of candidates) {
    const prefix = String(query.queryKey[0])
    const count = seen.get(prefix) ?? 0
    if (count >= (PREFIX_CAPS[prefix] ?? DEFAULT_PREFIX_CAP)) continue
    const serialized = JSON.stringify(query)
    if (used + serialized.length > budget) break
    seen.set(prefix, count + 1)
    used += serialized.length
    kept.push(query)
    serializedQueries.push(serialized)
  }

  return {
    client: {
      timestamp: client.timestamp,
      buster: client.buster,
      clientState: { mutations: [], queries: kept },
    },
    serializedQueries,
  }
}

/**
 * The string that goes to disk.
 *
 * Assembled from the per-query strings `trimPersistedClient` already made
 * for the budget, rather than stringified a second time from the trimmed
 * object: at a megabyte every few seconds the second pass is the one that
 * would be felt.
 */
export function serializePersistedClient(client: PersistedClientLike): string {
  const { serializedQueries } = trimPersistedClient(client)
  return (
    `{"timestamp":${JSON.stringify(client.timestamp)},` +
    `"buster":${JSON.stringify(client.buster)},` +
    `"clientState":{"mutations":[],"queries":[${serializedQueries.join(',')}]}}`
  )
}

/**
 * What came back from disk, or a throw.
 *
 * A throw is the right answer for anything that is not the envelope this
 * module writes: the caller discards the stored cache and carries on with an
 * empty one. Returning a partial object instead would hand `hydrate` a shape
 * it did not write, and the failure would surface on a screen rather than
 * here.
 */
export function parsePersistedClient(raw: string): PersistedClientLike {
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object') throw new Error('Persisted cache is not an object')
  const client = parsed as Partial<PersistedClientLike>
  if (typeof client.timestamp !== 'number' || typeof client.buster !== 'string') {
    throw new Error('Persisted cache has no envelope')
  }
  if (!client.clientState || !Array.isArray(client.clientState.queries)) {
    throw new Error('Persisted cache has no queries')
  }
  return client as PersistedClientLike
}

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

export interface ClosableStorage extends KeyValueStorage {
  /** No write lands after this; reads and removals still do. */
  close(): void
}

/**
 * A storage whose writes can be switched off for good.
 *
 * The persister throttles its writes, and the throttle is trailing: the last
 * cache change before a sign-out is written up to `PERSIST_THROTTLE_MS` *after*
 * it. By then the account-switch effect has already deleted that account's
 * file, and the late write would put it back — the previous person's chats,
 * on disk, on a phone they just signed out of. Closing the storage in the
 * effect's cleanup is what stops that write; deleting the file is what removes
 * what was written before it. Both are needed, and neither is timing-based.
 */
export function guardWrites(storage: KeyValueStorage): ClosableStorage {
  let closed = false
  return {
    getItem: (key) => storage.getItem(key),
    setItem: async (key, value) => {
      if (closed) return
      await storage.setItem(key, value)
    },
    removeItem: (key) => storage.removeItem(key),
    close: () => {
      closed = true
    },
  }
}
