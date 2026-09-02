import { ObjectId } from 'mongodb'
import { describe, expect, it } from 'vitest'
import { ApiError } from './ApiError'
import { decodeFeedCursor, encodeFeedCursor } from './feedCursor'

describe('feed cursor', () => {
  const at = new Date('2026-08-29T17:50:49.159Z')
  const id = new ObjectId('65f0000000000000000000ff')

  it('round-trips a cursor from the people you follow', () => {
    const decoded = decodeFeedCursor(encodeFeedCursor(at, id, 3, true))
    expect(decoded.followed).toBe(true)
    expect(decoded.count).toBe(3)
    expect(decoded.date.toISOString()).toBe(at.toISOString())
    expect(decoded.id.toHexString()).toBe(id.toHexString())
  })

  it('round-trips a cursor from everybody else', () => {
    const decoded = decodeFeedCursor(encodeFeedCursor(at, id, 3, false))
    expect(decoded.followed).toBe(false)
    expect(decoded.count).toBe(3)
    expect(decoded.date.toISOString()).toBe(at.toISOString())
  })

  it('round-trips a zero count', () => {
    // The common case: every post nobody has answered yet.
    expect(decodeFeedCursor(encodeFeedCursor(at, id, 0, false)).count).toBe(0)
  })

  it('rejects a malformed cursor', () => {
    expect(() => decodeFeedCursor('nonsense')).toThrow(ApiError)
    expect(() => decodeFeedCursor('7.nonsense')).toThrow(ApiError)
    expect(() => decodeFeedCursor('f.nonsense')).toThrow(ApiError)
    // The old countless form from the recency-only tab. An ISO timestamp's
    // own dot must not be mistaken for the count separator.
    expect(() => decodeFeedCursor(`${at.toISOString()}|${id.toHexString()}`)).toThrow(ApiError)
  })
})
