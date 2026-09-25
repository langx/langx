import { InfiniteQueryObserver, QueryClient, type InfiniteData } from '@tanstack/react-query'
import { afterEach, describe, expect, it } from 'vitest'
import { keepUnwatchedThreadsShort } from './queryLifetimes'

type Page = { items: string[] }

function threadPages(count: number): InfiniteData<Page, string> {
  return {
    pages: Array.from({ length: count }, (_, i) => ({ items: [`m${i}`] })),
    pageParams: Array.from({ length: count }, (_, i) => (i === 0 ? '' : `cursor-${i}`)),
  }
}

let client: QueryClient
afterEach(() => client.clear())

function setUp(): QueryClient {
  client = new QueryClient()
  keepUnwatchedThreadsShort(client)
  return client
}

/** A screen showing the query, without React: what `useInfiniteQuery` holds. */
function watch(queryKey: readonly unknown[]): () => void {
  const observer = new InfiniteQueryObserver<
    Page,
    Error,
    InfiniteData<Page, string>,
    readonly unknown[],
    string
  >(client, {
    queryKey,
    queryFn: () => Promise.resolve({ items: [] }),
    initialPageParam: '',
    getNextPageParam: () => undefined,
    // No fetch on subscribe: the test is about what leaving does.
    staleTime: Infinity,
  })
  return observer.subscribe(() => undefined)
}

function pageCount(queryKey: readonly unknown[]): number | undefined {
  return client.getQueryData<InfiniteData<Page, string>>(queryKey)?.pages.length
}

describe('keepUnwatchedThreadsShort', () => {
  it('leaves a thread whole while a screen shows it, and cuts it when the screen goes', () => {
    setUp()
    const key = ['messages', 'c1']
    const stop = watch(key)
    client.setQueryData(key, threadPages(3), { updatedAt: 1_234 })
    expect(pageCount(key)).toBe(3)

    stop()
    expect(pageCount(key)).toBe(1)
    expect(client.getQueryData<InfiniteData<Page, string>>(key)?.pageParams).toEqual([''])
    // The cut changes the page count and nothing about freshness.
    expect(client.getQueryState(key)?.dataUpdatedAt).toBe(1_234)
  })

  it('cuts a refetch that lands after the screen has gone', () => {
    setUp()
    const key = ['messages', 'c1']
    client.setQueryData(key, threadPages(1))
    client.setQueryData(key, threadPages(4))
    expect(pageCount(key)).toBe(1)
  })

  it('keeps a thread due a refetch due one', async () => {
    setUp()
    const key = ['messages', 'c1']
    const stop = watch(key)
    client.setQueryData(key, threadPages(2))
    await client.invalidateQueries({ queryKey: key, refetchType: 'none' })
    stop()
    expect(pageCount(key)).toBe(1)
    await Promise.resolve()
    expect(client.getQueryState(key)?.isInvalidated).toBe(true)
  })

  it('leaves a jump window and every other paged list alone', () => {
    setUp()
    for (const key of [
      ['messages', 'c1', 'around', 'm9'],
      ['conversations', 'all'],
      ['feed', 'all'],
    ]) {
      const stop = watch(key)
      client.setQueryData(key, threadPages(3))
      stop()
      expect(pageCount(key), key.join('/')).toBe(3)
    }
  })
})
