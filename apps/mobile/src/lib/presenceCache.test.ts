import { describe, expect, it } from 'vitest'
import { applyPresence } from './presenceCache'

const stale = new Date(Date.now() - 27 * 60_000).toISOString()
const fresh = new Date().toISOString()
const sofia = { _id: 'u1', handle: 'sofia', isOnline: false, lastActiveAt: stale }

describe('applyPresence', () => {
  it('moves the sender to online at the time of their message', () => {
    expect(applyPresence(sofia, 'u1', fresh)).toEqual({
      ...sofia,
      lastActiveAt: fresh,
      isOnline: true,
    })
  })

  it('leaves somebody else alone', () => {
    expect(applyPresence(sofia, 'u2', fresh)).toBe(sofia)
  })

  it('never reveals the presence of someone who hides it', () => {
    const hidden = { _id: 'u1', isOnline: false }
    expect(applyPresence(hidden, 'u1', fresh)).toBe(hidden)
  })

  it('does not move presence backwards for a late event', () => {
    const current = { ...sofia, lastActiveAt: fresh, isOnline: true }
    expect(applyPresence(current, 'u1', stale)).toBe(current)
  })

  it('passes an empty cache through', () => {
    expect(applyPresence(undefined, 'u1', fresh)).toBeUndefined()
  })
})
