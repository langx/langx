import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { settleWithin } from './settleWithin'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('settleWithin', () => {
  it('resolves as soon as the work resolves', async () => {
    const settled = vi.fn()
    void settleWithin(5_000, Promise.resolve('done')).then(settled)

    await vi.advanceTimersByTimeAsync(0)
    expect(settled).toHaveBeenCalled()
  })

  it('resolves when the work rejects, rather than rejecting with it', async () => {
    const settled = vi.fn()
    void settleWithin(5_000, Promise.reject(new Error('no'))).then(settled)

    await vi.advanceTimersByTimeAsync(0)
    expect(settled).toHaveBeenCalled()
  })

  // The case this exists for: a native call that answers neither way.
  it('gives up on work that never settles', async () => {
    const settled = vi.fn()
    void settleWithin(5_000, new Promise(() => {})).then(settled)

    await vi.advanceTimersByTimeAsync(4_999)
    expect(settled).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(settled).toHaveBeenCalled()
  })

  it('does not hold the timer open once the work has answered', async () => {
    const pending = vi.getTimerCount()
    await settleWithin(5_000, Promise.resolve())

    expect(vi.getTimerCount()).toBe(pending)
  })
})
