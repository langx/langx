import { describe, expect, it } from 'vitest'
import { PHOTO_NUDGE_QUIET_MS, photoNudgeDue, withPhotoNudgeClosed } from './photoNudge'

const NOW = new Date('2026-10-20T12:00:00Z')

describe('the Me screen photo nudge', () => {
  it('shows for an account that never closed it, and for any unreadable store', () => {
    expect(photoNudgeDue(null, 'a', NOW)).toBe(true)
    expect(photoNudgeDue('garbage', 'a', NOW)).toBe(true)
    expect(photoNudgeDue({ a: 'not a date' }, 'a', NOW)).toBe(true)
  })

  it('stays away for a week after it is closed, for that account only', () => {
    const stored = withPhotoNudgeClosed(null, 'a', NOW)
    expect(photoNudgeDue(stored, 'a', NOW)).toBe(false)
    expect(photoNudgeDue(stored, 'b', NOW)).toBe(true)
    const almost = new Date(NOW.getTime() + PHOTO_NUDGE_QUIET_MS - 1)
    expect(photoNudgeDue(stored, 'a', almost)).toBe(false)
    const week = new Date(NOW.getTime() + PHOTO_NUDGE_QUIET_MS)
    expect(photoNudgeDue(stored, 'a', week)).toBe(true)
  })

  it('remembers a bounded number of accounts, forgetting the oldest', () => {
    let stored: unknown = null
    for (let i = 0; i < 12; i++) {
      stored = withPhotoNudgeClosed(stored, `acc${i}`, new Date(NOW.getTime() + i * 1000))
    }
    const ids = Object.keys(stored as object)
    expect(ids).toHaveLength(10)
    expect(ids).not.toContain('acc0')
    expect(ids).toContain('acc11')
  })
})
