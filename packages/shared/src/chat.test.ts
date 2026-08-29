import { describe, expect, it } from 'vitest'
import { DELIVERY_STATES, canDeleteForEveryone, canEditMessage, deliveryStateOf } from './chat'

describe('deliveryStateOf', () => {
  it('is sent when the server has it and nothing more is known', () => {
    expect(deliveryStateOf({})).toBe('sent')
  })

  it('is delivered once it has reached the recipient device', () => {
    expect(deliveryStateOf({ deliveredAt: new Date() })).toBe('delivered')
  })

  it('is read once they have opened the thread', () => {
    expect(deliveryStateOf({ deliveredAt: new Date(), readAt: new Date() })).toBe('read')
  })

  /**
   * The reason `readAt` is checked first. Every message that predates
   * `deliveredAt` — the v1 import, and everything sent before the second tick
   * shipped — has a `readAt` and no `deliveredAt`, and showing those as one
   * tick would be a visible regression across the whole of history.
   */
  it('reads a message with no delivery stamp as read, not as sent', () => {
    expect(deliveryStateOf({ readAt: new Date() })).toBe('read')
  })

  it('ignores explicit nulls the way it ignores absent fields', () => {
    expect(deliveryStateOf({ deliveredAt: null, readAt: null })).toBe('sent')
  })

  it('accepts the ISO strings the API actually sends', () => {
    expect(deliveryStateOf({ deliveredAt: '2026-08-28T10:00:00.000Z' })).toBe('delivered')
    expect(deliveryStateOf({ readAt: '2026-08-28T10:00:00.000Z' })).toBe('read')
  })

  it('lists the states in the order a message passes through them', () => {
    expect(DELIVERY_STATES).toEqual(['sent', 'delivered', 'read'])
  })
})

describe('canDeleteForEveryone', () => {
  const now = new Date('2026-08-29T12:00:00.000Z')
  const mine = { senderId: 'me', createdAt: '2026-08-29T11:00:00.000Z' }

  it('allows the sender inside the window', () => {
    expect(canDeleteForEveryone(mine, 'me', now)).toBe(true)
  })

  it('refuses someone else message', () => {
    expect(canDeleteForEveryone(mine, 'them', now)).toBe(false)
  })

  it('refuses one already withdrawn, which is what stops the row being offered twice', () => {
    expect(canDeleteForEveryone({ ...mine, deletedAt: now }, 'me', now)).toBe(false)
  })

  it('refuses one past the window', () => {
    const old = { senderId: 'me', createdAt: '2026-08-26T11:00:00.000Z' }
    expect(canDeleteForEveryone(old, 'me', now)).toBe(false)
  })
})

describe('canEditMessage', () => {
  const now = new Date('2026-08-29T12:00:00.000Z')
  const mine = { senderId: 'me', type: 'text', createdAt: '2026-08-29T11:00:00.000Z' }

  it('allows your own recent text', () => {
    expect(canEditMessage(mine, 'me', now)).toBe(true)
  })

  it('refuses someone else message, and anything that is not text', () => {
    expect(canEditMessage(mine, 'them', now)).toBe(false)
    for (const type of ['image', 'audio', 'correction']) {
      expect(canEditMessage({ ...mine, type }, 'me', now)).toBe(false)
    }
  })

  /**
   * The clause that keeps `correction.original` honest: editing a sentence
   * someone has already corrected would leave their correction quoting
   * something that no longer exists.
   */
  it('refuses one somebody has corrected', () => {
    expect(canEditMessage({ ...mine, corrected: true }, 'me', now)).toBe(false)
  })

  it('refuses one past the window, and one already withdrawn', () => {
    const old = { ...mine, createdAt: '2026-08-26T11:00:00.000Z' }
    expect(canEditMessage(old, 'me', now)).toBe(false)
    expect(canEditMessage({ ...mine, deletedAt: now }, 'me', now)).toBe(false)
  })
})
