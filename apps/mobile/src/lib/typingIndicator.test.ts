import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { typingIndicator } from './typingIndicator'

describe('the other person typing', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  function track() {
    const seen: boolean[] = []
    const indicator = typingIndicator((typing) => seen.push(typing), 6000)
    return { seen, indicator, latest: () => seen.at(-1) }
  }

  it('shows at once and hides on the stop signal', () => {
    const { indicator, latest } = track()
    indicator.set(true)
    expect(latest()).toBe(true)
    indicator.set(false)
    expect(latest()).toBe(false)
  })

  /** The stop that never came: a locked phone, a missed event, a race. */
  it('hides by itself when nothing refreshes it', () => {
    const { indicator, latest } = track()
    indicator.set(true)
    vi.advanceTimersByTime(5999)
    expect(latest()).toBe(true)
    vi.advanceTimersByTime(1)
    expect(latest()).toBe(false)
  })

  it('stays up for as long as keystrokes keep arriving', () => {
    const { indicator, latest } = track()
    for (let i = 0; i < 10; i++) {
      indicator.set(true)
      vi.advanceTimersByTime(3000)
    }
    expect(latest()).toBe(true)
  })

  /** A stop followed by an old clock firing must not flip anything back. */
  it('leaves no clock behind after a stop', () => {
    const { indicator, seen } = track()
    indicator.set(true)
    indicator.set(false)
    const before = seen.length
    vi.advanceTimersByTime(10_000)
    expect(seen.length).toBe(before)
  })

  it('reports nothing once disposed', () => {
    const { indicator, seen } = track()
    indicator.set(true)
    indicator.dispose()
    const before = seen.length
    vi.advanceTimersByTime(10_000)
    expect(seen.length).toBe(before)
  })
})
