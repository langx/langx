import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, string>()
vi.mock('./localFlags', () => ({
  FLAG_KEYS: { pendingIntent: 'pendingIntent' },
  readJsonFlag: vi.fn((key: string) => {
    const raw = store.get(key)
    return Promise.resolve(raw ? (JSON.parse(raw) as unknown) : null)
  }),
  writeJsonFlag: vi.fn((key: string, value: unknown) => {
    store.set(key, JSON.stringify(value))
    return Promise.resolve()
  }),
  clearFlag: vi.fn((key: string) => {
    store.delete(key)
    return Promise.resolve()
  }),
}))

const { writePendingMessageIntent, takePendingIntent } = await import('./pendingIntent')

describe('pendingIntent', () => {
  beforeEach(() => store.clear())

  it('remembers who the guest wanted to talk to', async () => {
    await writePendingMessageIntent('u1')
    expect(await takePendingIntent()).toEqual({ kind: 'message', toUserId: 'u1' })
  })

  /**
   * The whole point of `take`: the offer is made once, to the person who
   * captured it, and never to whoever signs up on this phone next.
   */
  it('is spent by reading it', async () => {
    await writePendingMessageIntent('u1')
    await takePendingIntent()
    expect(await takePendingIntent()).toBeNull()
  })

  it('reads as nothing when there was never an intent', async () => {
    expect(await takePendingIntent()).toBeNull()
  })

  /** A value written by an older build must not reach a route as `undefined`. */
  it('rejects a stored value of the wrong shape, and clears it', async () => {
    store.set('pendingIntent', JSON.stringify({ kind: 'message' }))
    expect(await takePendingIntent()).toBeNull()
    expect(store.has('pendingIntent')).toBe(false)
  })
})
