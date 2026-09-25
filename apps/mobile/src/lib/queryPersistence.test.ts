import { describe, expect, it } from 'vitest'
import {
  PERSIST_BUDGET_CHARS,
  PERSIST_MAX_AGE_MS,
  QUERY_CACHE_VERSION,
  firstPageOnly,
  guardWrites,
  isRestorable,
  parsePersistedClient,
  persistedCacheKey,
  serializePersistedClient,
  shouldPersistQuery,
  trimPersistedClient,
  trimsWhenUnwatched,
  type KeyValueStorage,
  type PersistedClientLike,
  type PersistedQueryLike,
} from './queryPersistence'

const WEEK = PERSIST_MAX_AGE_MS

function query(
  queryKey: readonly unknown[],
  data: unknown,
  dataUpdatedAt = 1_000,
  status = 'success',
): PersistedQueryLike & { queryHash: string } {
  return {
    queryHash: JSON.stringify(queryKey),
    queryKey,
    state: { data, dataUpdatedAt, status },
  }
}

function client(queries: PersistedQueryLike[]): PersistedClientLike {
  return { timestamp: 1_700_000_000_000, buster: QUERY_CACHE_VERSION, clientState: { queries } }
}

function pages(count: number, size = 1): { pages: unknown[]; pageParams: unknown[] } {
  return {
    pages: Array.from({ length: count }, (_, i) => ({ items: Array(size).fill(`row-${i}`) })),
    pageParams: Array.from({ length: count }, (_, i) => (i === 0 ? '' : `cursor-${i}`)),
  }
}

function persistable(queryKey: readonly unknown[], gcTime = WEEK, data: unknown = {}) {
  return shouldPersistQuery({ queryKey, gcTime, state: { data } })
}

describe('shouldPersistQuery', () => {
  it('keeps the everyday prefixes when their gcTime covers the cache lifetime', () => {
    for (const key of [
      ['conversations', 'all'],
      ['conversations', 'one', 'c1'],
      ['messages', 'c1'],
      ['profile', 'u1'],
      ['me'],
      ['unread'],
      ['feed', 'corrections'],
      ['discovery', '{}'],
      ['notifications'],
      ['tokens'],
    ]) {
      expect(persistable(key), key.join('/')).toBe(true)
    }
  })

  it('refuses the deny-listed prefixes whatever their gcTime', () => {
    for (const key of [
      ['app-config'],
      ['admin', 'stats'],
      ['echo', 'queue', 'fr'],
      ['suspension'],
      ['handleSearch', 'so'],
      ['handle-availability', 'sofia'],
      ['cities', 'tor'],
      ['linkPreview', 'https://example.com'],
    ]) {
      expect(persistable(key, Infinity), key.join('/')).toBe(false)
    }
  })

  it('refuses a jump window even though it sits under the messages prefix', () => {
    expect(persistable(['messages', 'c1', 'around', 'm9'])).toBe(false)
  })

  it('refuses anything given a deliberately shorter life than the cache', () => {
    expect(persistable(['messages', 'c1'], 60_000)).toBe(false)
    expect(persistable(['feed', 'all'], 0)).toBe(false)
    expect(persistable(['feed', 'all'], Infinity)).toBe(true)
  })

  it('refuses a query with nothing in it, and a key that does not start with a string', () => {
    expect(shouldPersistQuery({ queryKey: ['me'], gcTime: WEEK, state: { data: undefined } })).toBe(
      false,
    )
    expect(persistable([{ odd: true }])).toBe(false)
    expect(persistable([])).toBe(false)
  })
})

describe('isRestorable', () => {
  const NOW = 1_700_000_000_000

  it('takes this version, inside the cache lifetime', () => {
    expect(isRestorable({ buster: QUERY_CACHE_VERSION, timestamp: NOW - WEEK }, NOW)).toBe(true)
  })

  it('refuses another version and anything older than the lifetime', () => {
    expect(isRestorable({ buster: `${QUERY_CACHE_VERSION}-old`, timestamp: NOW }, NOW)).toBe(false)
    expect(isRestorable({ buster: QUERY_CACHE_VERSION, timestamp: NOW - WEEK - 1 }, NOW)).toBe(
      false,
    )
  })
})

describe('firstPageOnly', () => {
  it('cuts pages and pageParams together', () => {
    expect(firstPageOnly(pages(3))).toEqual({ pages: [{ items: ['row-0'] }], pageParams: [''] })
  })

  it('hands back the identical value when there is nothing to cut', () => {
    const single = pages(1)
    const plain = { _id: 'u1' }
    expect(firstPageOnly(single)).toBe(single)
    expect(firstPageOnly(plain)).toBe(plain)
    expect(firstPageOnly(undefined)).toBeUndefined()
  })
})

describe('trimsWhenUnwatched', () => {
  it('is a live thread and nothing else', () => {
    expect(trimsWhenUnwatched(['messages', 'c1'])).toBe(true)
    expect(trimsWhenUnwatched(['messages', 'c1', 'around', 'm9'])).toBe(false)
    expect(trimsWhenUnwatched(['conversations', 'all'])).toBe(false)
    expect(trimsWhenUnwatched(['feed', 'all'])).toBe(false)
  })
})

describe('trimPersistedClient', () => {
  it('cuts every infinite query to its first page and keeps pageParams in step', () => {
    const { client: trimmed } = trimPersistedClient(
      client([query(['messages', 'c1'], pages(4), 2), query(['me'], { _id: 'u1' }, 1)]),
    )
    const [messages, me] = trimmed.clientState.queries
    expect(messages?.state.data).toEqual({ pages: [{ items: ['row-0'] }], pageParams: [''] })
    expect(me?.state.data).toEqual({ _id: 'u1' })
  })

  it('writes every state as stale, idle and without a fetch in flight', () => {
    const { client: trimmed } = trimPersistedClient(client([query(['me'], { _id: 'u1' })]))
    expect(trimmed.clientState.queries[0]?.state).toMatchObject({
      status: 'success',
      isInvalidated: true,
      fetchStatus: 'idle',
      fetchMeta: null,
    })
  })

  it('writes a list whose refetch failed as the success it was', () => {
    const failed = query(['conversations', 'all'], pages(1), 5, 'error')
    const withError = {
      ...failed,
      state: { ...failed.state, error: { code: 'INTERNAL' }, fetchFailureCount: 2 },
    }
    const { client: trimmed } = trimPersistedClient(client([withError]))
    expect(trimmed.clientState.queries[0]?.state).toMatchObject({
      status: 'success',
      error: null,
      fetchFailureCount: 0,
      fetchFailureReason: null,
    })
    expect(trimmed.clientState.queries[0]?.state.data).toEqual(pages(1))
  })

  it('drops a query that has no data to restore', () => {
    const { client: trimmed } = trimPersistedClient(client([query(['me'], undefined)]))
    expect(trimmed.clientState.queries).toHaveLength(0)
  })

  it('orders newest first and caps each prefix at its own ceiling', () => {
    const threads = Array.from({ length: 45 }, (_, i) => query(['messages', `c${i}`], pages(1), i))
    const { client: trimmed } = trimPersistedClient(client(threads))
    const kept = trimmed.clientState.queries.map((q) => q.queryKey[1])
    expect(kept).toHaveLength(40)
    expect(kept[0]).toBe('c44')
    expect(kept).not.toContain('c0')
  })

  it('applies the default ceiling to a prefix without one of its own', () => {
    const rows = Array.from({ length: 60 }, (_, i) => query(['profileSummary', `h${i}`], { i }, i))
    const { client: trimmed } = trimPersistedClient(client(rows))
    expect(trimmed.clientState.queries).toHaveLength(50)
  })

  it('stops at the budget, keeping what was fetched most recently', () => {
    const big = 'x'.repeat(1_000)
    const rows = Array.from({ length: 10 }, (_, i) => query(['profile', `u${i}`], { big }, i))
    // Room for three and a half rows, measured rather than guessed.
    const one = trimPersistedClient(client([rows[0]!])).serializedQueries[0]!.length
    const budget = Math.floor(one * 3.5)
    const { client: trimmed, serializedQueries } = trimPersistedClient(client(rows), budget)
    expect(trimmed.clientState.queries.map((q) => q.queryKey[1])).toEqual(['u9', 'u8', 'u7'])
    expect(serializedQueries).toHaveLength(3)
    expect(serializedQueries.join('').length).toBeLessThanOrEqual(budget)
  })

  it('never writes mutations', () => {
    const withMutations: PersistedClientLike = {
      ...client([query(['me'], {})]),
      clientState: { mutations: [{ any: 'thing' }], queries: [query(['me'], {})] },
    }
    expect(trimPersistedClient(withMutations).client.clientState.mutations).toEqual([])
  })

  it('leaves the default budget where the docs say it is', () => {
    expect(PERSIST_BUDGET_CHARS).toBe(2_000_000)
  })
})

describe('serializePersistedClient and parsePersistedClient', () => {
  it('round-trip to exactly the trimmed client', () => {
    const original = client([
      query(['conversations', 'all'], pages(3, 2), 5),
      query(['profile', 'u1'], { handle: 'sofia', displayName: 'Sofia R.' }, 9),
    ])
    const parsed = parsePersistedClient(serializePersistedClient(original))
    expect(parsed).toEqual(trimPersistedClient(original).client)
    expect(parsed.clientState.queries[0]?.queryKey).toEqual(['profile', 'u1'])
  })

  it('keeps every field of a query it did not need to read', () => {
    const rich = { ...query(['me'], { _id: 'u1' }), meta: { from: 'test' }, dehydratedAt: 7 }
    const [parsed] = parsePersistedClient(serializePersistedClient(client([rich]))).clientState
      .queries as (typeof rich)[]
    expect(parsed).toMatchObject({ queryHash: '["me"]', meta: { from: 'test' }, dehydratedAt: 7 })
  })

  it('throws on anything that is not the envelope it writes', () => {
    expect(() => parsePersistedClient('null')).toThrow()
    expect(() => parsePersistedClient('"a string"')).toThrow()
    expect(() => parsePersistedClient('{}')).toThrow()
    expect(() => parsePersistedClient('{"timestamp":1,"buster":"1"}')).toThrow()
    expect(() =>
      parsePersistedClient('{"timestamp":1,"buster":"1","clientState":{"queries":{}}}'),
    ).toThrow()
    expect(() => parsePersistedClient('not json')).toThrow()
  })
})

describe('persistedCacheKey', () => {
  it('is one key per account, made of characters a file name is safe with', () => {
    expect(persistedCacheKey('68d1a0ffc2b4e3a1d9f0c123')).toBe('queries-68d1a0ffc2b4e3a1d9f0c123')
    expect(persistedCacheKey('../etc/passwd')).toBe('queries-___etc_passwd')
    expect(persistedCacheKey('a')).not.toBe(persistedCacheKey('b'))
  })
})

describe('guardWrites', () => {
  function fakeStorage(): KeyValueStorage & { rows: Map<string, string> } {
    const rows = new Map<string, string>()
    return {
      rows,
      getItem: (key) => Promise.resolve(rows.get(key) ?? null),
      setItem: (key, value) => {
        rows.set(key, value)
        return Promise.resolve()
      },
      removeItem: (key) => {
        rows.delete(key)
        return Promise.resolve()
      },
    }
  }

  it('passes reads and writes through until closed', async () => {
    const guarded = guardWrites(fakeStorage())
    await guarded.setItem('k', 'v')
    expect(await guarded.getItem('k')).toBe('v')
  })

  it('drops a write that arrives after close, and still removes', async () => {
    const inner = fakeStorage()
    const guarded = guardWrites(inner)
    await guarded.setItem('k', 'before')
    guarded.close()
    await guarded.removeItem('k')
    // The trailing throttled write of a signed-out account: it must not
    // resurrect the file the cleanup just deleted.
    await guarded.setItem('k', 'late')
    expect(inner.rows.has('k')).toBe(false)
    expect(await guarded.getItem('k')).toBeNull()
  })
})
