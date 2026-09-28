import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { withTimeout } from './withTimeout'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('withTimeout', () => {
  it('resolves with the result when it arrives in time', async () => {
    await expect(withTimeout(Promise.resolve('fix'), 1000)).resolves.toBe('fix')
  })

  it('resolves with null when the work outlasts the deadline', async () => {
    const never = new Promise<string>(() => {})
    const raced = withTimeout(never, 1000)
    await vi.advanceTimersByTimeAsync(1000)
    await expect(raced).resolves.toBeNull()
  })

  it('passes a rejection through when it comes first', async () => {
    await expect(withTimeout(Promise.reject(new Error('off')), 1000)).rejects.toThrow('off')
  })

  it('absorbs a rejection that comes after the deadline', async () => {
    let fail: (error: Error) => void = () => {}
    const late = new Promise<string>((_, reject) => {
      fail = reject
    })
    const raced = withTimeout(late, 1000)
    await vi.advanceTimersByTimeAsync(1000)
    fail(new Error('too late'))
    await expect(raced).resolves.toBeNull()
  })
})
