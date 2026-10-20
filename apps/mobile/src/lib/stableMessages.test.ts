import { describe, expect, it } from 'vitest'
import { keepIdentity, sameValue } from './stableMessages'

type Message = { _id: string; body: string; reactions?: Record<string, string[]>; readAt?: string }

const msg = (id: string, extra: Partial<Message> = {}): Message => ({ _id: id, body: id, ...extra })

describe('keepIdentity', () => {
  it('keeps an unchanged message the same object when the window slides', () => {
    const a = msg('a')
    const b = msg('b')
    const first = keepIdentity(new Map<string, Message>(), [b, a])
    // A refetch: fresh objects, everything moved along by one new message.
    const second = keepIdentity(first.byId, [msg('c'), msg('b'), msg('a')])
    expect(second.items[1]).toBe(b)
    expect(second.items[2]).toBe(a)
    expect(second.items[0]?._id).toBe('c')
  })

  it('takes the new object for a message that changed', () => {
    const a = msg('a', { reactions: { '❤️': ['u1'] } })
    const first = keepIdentity(new Map<string, Message>(), [a])
    const changed = msg('a', { reactions: { '❤️': ['u1', 'u2'] } })
    const second = keepIdentity(first.byId, [changed])
    expect(second.items[0]).toBe(changed)
    expect(second.byId.get('a')).toBe(changed)
  })

  it('notices a field that appears', () => {
    const first = keepIdentity(new Map<string, Message>(), [msg('a')])
    const read = msg('a', { readAt: '2026-10-19T10:00:00.000Z' })
    expect(keepIdentity(first.byId, [read]).items[0]).toBe(read)
  })

  it('forgets messages that left the window', () => {
    const first = keepIdentity(new Map<string, Message>(), [msg('a'), msg('b')])
    expect(keepIdentity(first.byId, [msg('a')]).byId.has('b')).toBe(false)
  })
})

describe('sameValue', () => {
  it('compares nested objects and arrays by value', () => {
    expect(sameValue({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true)
    expect(sameValue({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false)
    expect(sameValue({ a: 1 }, { a: 1, b: undefined })).toBe(false)
    expect(sameValue([1, 2], { 0: 1, 1: 2 })).toBe(false)
    expect(sameValue(null, {})).toBe(false)
  })
})
