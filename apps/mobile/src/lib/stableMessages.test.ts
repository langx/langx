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

  /*
   * Every change the server can make to a message already on screen. Each is
   * a field on the message itself — `message:updated` replaces the whole
   * message, delivery and read refetch or patch it — so each must hand the
   * bubble a new object, or the row would go on drawing the old state.
   * (A private translation and a voice note's progress are not on the
   * message: one is its own prop, the other the player's own state.)
   */
  it.each([
    ['an edit', { body: 'a, edited', editedAt: '2026-10-19T10:00:00.000Z' }],
    ['a delete', { deleted: true, body: '' }],
    ['view-once being opened', { viewOnce: { openedAt: '2026-10-19T10:00:00.000Z' } }],
    ['a reaction added', { reactions: { '👍': ['u2'] } }],
    ['a delivery', { deliveredAt: '2026-10-19T10:00:00.000Z' }],
    ['a read receipt', { readAt: '2026-10-19T10:00:00.000Z' }],
    ['a correction applied to it', { corrected: true }],
    ['a translation the sender published', { translation: { text: 'b', lang: 'en' } }],
    ['being added to Echo', { echoed: true }],
  ])('hands over a new object for %s', (_, change) => {
    type Loose = { _id: string } & Record<string, unknown>
    const before: Loose = { ...msg('a'), viewOnce: { openedAt: null } }
    const first = keepIdentity(new Map<string, Loose>(), [before])
    const after: Loose = { ...before, ...change }
    expect(keepIdentity(first.byId, [after]).items[0]).toBe(after)
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
