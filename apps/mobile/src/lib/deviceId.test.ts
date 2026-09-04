import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, string>()
vi.mock('./localFlags', () => ({
  FLAG_KEYS: { deviceId: 'deviceId' },
  readFlag: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
  writeFlag: vi.fn((key: string, value: string) => {
    store.set(key, value)
    return Promise.resolve()
  }),
}))

const { deviceId, forgetDeviceIdCache } = await import('./deviceId')

describe('deviceId', () => {
  beforeEach(() => {
    store.clear()
    forgetDeviceIdCache()
  })

  it('gives the same id back on a second read', async () => {
    const first = await deviceId()
    forgetDeviceIdCache()
    expect(await deviceId()).toBe(first)
  })

  it('shares one read between concurrent callers', async () => {
    const [a, b] = await Promise.all([deviceId(), deviceId()])
    expect(a).toBe(b)
  })

  it('mints a fresh id when storage held nothing', async () => {
    const first = await deviceId()
    store.clear()
    forgetDeviceIdCache()
    expect(await deviceId()).not.toBe(first)
  })

  it('works without crypto.randomUUID', async () => {
    const original = globalThis.crypto
    // Some old engines have no `crypto` at all; an id is still required.
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true })
    try {
      expect(await deviceId()).toMatch(/^d-/)
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true })
    }
  })
})
