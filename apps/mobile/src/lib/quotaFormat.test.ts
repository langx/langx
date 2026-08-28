import { describe, expect, it } from 'vitest'
import { formatQuota } from './quotaFormat'

describe('formatQuota', () => {
  it('reads a null limit as unlimited rather than as a missing value', () => {
    expect(formatQuota({ limit: null, remaining: null, nextAvailableAt: null })).toBe('∞')
  })

  it('shows what is left out of the limit', () => {
    expect(formatQuota({ limit: 5, remaining: 3, nextAvailableAt: null })).toBe('3 / 5')
  })

  /**
   * The reset time is the expiry of the oldest timestamp in the window, which
   * is only the answer to "when can I do this again" once nothing is left.
   */
  it('stays quiet about the reset time while there is anything left', () => {
    const at = new Date(Date.now() + 3_600_000).toISOString()
    expect(formatQuota({ limit: 5, remaining: 1, nextAvailableAt: at })).toBe('1 / 5')
  })

  it('appends the reset time once the bucket is empty', () => {
    const at = new Date(2026, 7, 28, 14, 20)
    expect(formatQuota({ limit: 5, remaining: 0, nextAvailableAt: at.toISOString() })).toBe(
      '0 / 5 · resets 14:20',
    )
  })

  it('falls back to the counts when the server sends no reset time', () => {
    expect(formatQuota({ limit: 5, remaining: 0, nextAvailableAt: null })).toBe('0 / 5')
  })
})
