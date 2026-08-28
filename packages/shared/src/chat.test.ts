import { describe, expect, it } from 'vitest'
import { DELIVERY_STATES, deliveryStateOf } from './chat'

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
