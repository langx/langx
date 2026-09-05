import { describe, expect, it } from 'vitest'
import { awaitNewSession, sortSessions } from './sessions'

const noSleep = (): Promise<void> => Promise.resolve()

describe('sortSessions', () => {
  it('puts the newest session first', () => {
    const sorted = sortSessions([
      { token: 'old', createdAt: '2026-09-01T10:00:00.000Z' },
      { token: 'new', createdAt: new Date('2026-09-05T10:00:00.000Z') },
      { token: 'mid', createdAt: '2026-09-03T10:00:00.000Z' },
    ])
    expect(sorted.map((s) => s.token)).toEqual(['new', 'mid', 'old'])
  })

  it('does not mutate the list it was given', () => {
    const rows = [
      { token: 'a', createdAt: '2026-09-01T00:00:00.000Z' },
      { token: 'b', createdAt: '2026-09-02T00:00:00.000Z' },
    ]
    sortSessions(rows)
    expect(rows.map((s) => s.token)).toEqual(['a', 'b'])
  })
})

describe('awaitNewSession', () => {
  it('returns the row that was not in the list before', async () => {
    const known = new Set(['phone'])
    const lists = [
      [{ token: 'phone', createdAt: '2026-09-05T09:00:00.000Z' }],
      [
        { token: 'phone', createdAt: '2026-09-05T09:00:00.000Z' },
        { token: 'laptop', createdAt: '2026-09-05T10:00:00.000Z' },
      ],
    ]
    let calls = 0
    const fresh = await awaitNewSession(
      () => Promise.resolve(lists[Math.min(calls++, lists.length - 1)]),
      known,
      { sleep: noSleep },
    )
    expect(fresh?.token).toBe('laptop')
    // Stopped as soon as it saw the row, not at the timeout.
    expect(calls).toBe(2)
  })

  it('gives up after the timeout and says so with null', async () => {
    let calls = 0
    const fresh = await awaitNewSession(
      () => {
        calls++
        return Promise.resolve([{ token: 'phone', createdAt: '2026-09-05T09:00:00.000Z' }])
      },
      new Set(['phone']),
      { intervalMs: 1000, timeoutMs: 5000, sleep: noSleep },
    )
    expect(fresh).toBeNull()
    expect(calls).toBe(5)
  })

  it('treats a failed refetch as "not yet", not as the end', async () => {
    let calls = 0
    const fresh = await awaitNewSession(
      () => {
        calls++
        if (calls === 1) return Promise.reject(new Error('offline'))
        return Promise.resolve([{ token: 'laptop', createdAt: '2026-09-05T10:00:00.000Z' }])
      },
      new Set(),
      { sleep: noSleep },
    )
    expect(fresh?.token).toBe('laptop')
    expect(calls).toBe(2)
  })

  it('waits before the first ask, since the row cannot exist yet', async () => {
    const waits: number[] = []
    await awaitNewSession(
      () => Promise.resolve([{ token: 'laptop', createdAt: '2026-09-05T10:00:00.000Z' }]),
      new Set(),
      {
        intervalMs: 1500,
        sleep: (ms) => {
          waits.push(ms)
          return Promise.resolve()
        },
      },
    )
    expect(waits).toEqual([1500])
  })
})
