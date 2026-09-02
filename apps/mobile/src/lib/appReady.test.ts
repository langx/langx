import { afterEach, describe, expect, it, vi } from 'vitest'
import { isAppReady, markAppReady, resetAppReadyForTest, subscribeToAppReady } from './appReady'

afterEach(() => {
  resetAppReadyForTest()
})

describe('appReady', () => {
  it('starts closed', () => {
    expect(isAppReady()).toBe(false)
  })

  it('tells everyone listening', () => {
    const one = vi.fn()
    const two = vi.fn()
    subscribeToAppReady(one)
    subscribeToAppReady(two)

    markAppReady()

    expect(one).toHaveBeenCalledOnce()
    expect(two).toHaveBeenCalledOnce()
    expect(isAppReady()).toBe(true)
  })

  /**
   * The whole reason this is a latch and not a boolean. Three things race to
   * set it — the screen that knows where it is going, the route fallback and
   * the timeout — and all three usually fire.
   */
  it('only fires once, however many things say so', () => {
    const listener = vi.fn()
    subscribeToAppReady(listener)

    markAppReady()
    markAppReady()
    markAppReady()

    expect(listener).toHaveBeenCalledOnce()
  })

  /**
   * `useSession` re-enters `isPending` on every sign-in and sign-out. If this
   * could be un-set, the opening animation would play over the app each time
   * somebody signed out.
   */
  it('cannot be closed again', () => {
    markAppReady()
    expect(isAppReady()).toBe(true)
    // There is deliberately no `markAppNotReady` to call.
    expect(isAppReady()).toBe(true)
  })

  it('stops telling a listener that unsubscribed', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToAppReady(listener)
    unsubscribe()

    markAppReady()

    expect(listener).not.toHaveBeenCalled()
  })

  it('reports ready to anything that subscribes afterwards', () => {
    markAppReady()
    const late = vi.fn()
    subscribeToAppReady(late)
    // Nothing to notify — the snapshot is what a late subscriber reads.
    expect(late).not.toHaveBeenCalled()
    expect(isAppReady()).toBe(true)
  })

  it('the test seam clears the flag and the listeners', () => {
    const listener = vi.fn()
    subscribeToAppReady(listener)
    markAppReady()

    resetAppReadyForTest()

    expect(isAppReady()).toBe(false)
    markAppReady()
    expect(listener).toHaveBeenCalledOnce()
  })
})
