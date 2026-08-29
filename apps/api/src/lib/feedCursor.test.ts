import { ObjectId } from 'mongodb'
import { describe, expect, it } from 'vitest'
import { ApiError } from './ApiError'
import { decodeFeedCursor, encodeFeedCursor } from './feedCursor'

describe('feed cursor', () => {
  const at = new Date('2026-08-29T17:50:49.159Z')
  const id = new ObjectId('65f0000000000000000000ff')

  it('round-trips a countless cursor', () => {
    // The regression. An ISO timestamp carries its own dot before the `Z`, so
    // splitting on the first one found the milliseconds and made this branch
    // unreachable — every `following` page-two request was a 400.
    const decoded = decodeFeedCursor(encodeFeedCursor(at, id, null))
    expect(decoded.count).toBeNull()
    expect(decoded.date.toISOString()).toBe(at.toISOString())
    expect(decoded.id.toHexString()).toBe(id.toHexString())
  })

  it('round-trips a counted cursor', () => {
    const decoded = decodeFeedCursor(encodeFeedCursor(at, id, 3))
    expect(decoded.count).toBe(3)
    expect(decoded.date.toISOString()).toBe(at.toISOString())
  })

  it('round-trips a zero count', () => {
    // The common case: every post nobody has answered yet.
    expect(decodeFeedCursor(encodeFeedCursor(at, id, 0)).count).toBe(0)
  })

  it('rejects a malformed cursor', () => {
    expect(() => decodeFeedCursor('nonsense')).toThrow(ApiError)
    expect(() => decodeFeedCursor('7.nonsense')).toThrow(ApiError)
  })
})
