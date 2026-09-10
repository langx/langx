import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, string>()
vi.mock('./localFlags', () => ({
  FLAG_KEYS: { installedAt: 'installedAt' },
  readFlag: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
  writeFlag: vi.fn((key: string, value: string) => {
    store.set(key, value)
    return Promise.resolve()
  }),
}))

const { markInstalled, secondsSinceInstall, forgetInstalledAtCache } = await import('./installedAt')

describe('installedAt', () => {
  beforeEach(() => {
    store.clear()
    forgetInstalledAtCache()
    vi.useRealTimers()
  })

  it('reports nothing before a launch was ever recorded', async () => {
    expect(await secondsSinceInstall()).toBeNull()
  })

  /** The number is what the whole event is for: an age, not a timestamp. */
  it('counts from the first recorded launch', async () => {
    store.set('installedAt', String(Date.now() - 90_000))
    expect(await secondsSinceInstall()).toBe(90)
  })

  it('keeps the first launch when the app is started again', async () => {
    store.set('installedAt', '1000')
    await markInstalled()
    expect(store.get('installedAt')).toBe('1000')
  })

  it('records a launch on a device that has none', async () => {
    await markInstalled()
    expect(Number(store.get('installedAt'))).toBeGreaterThan(0)
    expect(await secondsSinceInstall()).toBe(0)
  })

  /** An unreadable or corrupted store reads as "nothing recorded", never as 1970. */
  it('reports nothing for a value that is not a time', async () => {
    store.set('installedAt', 'yesterday')
    expect(await secondsSinceInstall()).toBeNull()
  })
})
