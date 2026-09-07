import { describe, expect, it } from 'vitest'
import {
  addOutgoing,
  isOutgoingId,
  MAX_OUTGOING,
  outgoingId,
  removeOutgoing,
  retireArrived,
  type OutgoingMessage,
} from './outgoingMessages'

const at = '2026-09-07T10:00:00.000Z'
const row = (clientId: string, body = clientId): OutgoingMessage => ({ clientId, body, sentAt: at })

describe('addOutgoing', () => {
  it('puts the newest first, like the inverted thread', () => {
    const list = addOutgoing(addOutgoing([], row('a')), row('b'))
    expect(list.map((m) => m.clientId)).toEqual(['b', 'a'])
  })

  it('replaces a row with the same clientId instead of stacking it', () => {
    const list = addOutgoing([row('a', 'first')], row('a', 'second'))
    expect(list).toHaveLength(1)
    expect(list[0]?.body).toBe('second')
  })

  it('keeps the list bounded', () => {
    let list: OutgoingMessage[] = []
    for (let i = 0; i < MAX_OUTGOING + 5; i++) list = addOutgoing(list, row(String(i)))
    expect(list).toHaveLength(MAX_OUTGOING)
    expect(list[0]?.clientId).toBe(String(MAX_OUTGOING + 4))
  })
})

describe('removeOutgoing', () => {
  it('removes by clientId and leaves the rest', () => {
    expect(removeOutgoing([row('a'), row('b')], 'a').map((m) => m.clientId)).toEqual(['b'])
  })
})

describe('retireArrived', () => {
  it('drops the rows the thread now holds', () => {
    const list = [row('a'), row('b'), row('c')]
    expect(retireArrived(list, ['b', undefined, 'zzz']).map((m) => m.clientId)).toEqual(['a', 'c'])
  })

  it('returns the list untouched when nothing has arrived', () => {
    const list = [row('a')]
    expect(retireArrived(list, [undefined])).toBe(list)
  })
})

describe('outgoing ids', () => {
  it('round-trips through the prefix', () => {
    expect(isOutgoingId(outgoingId('abc'))).toBe(true)
    expect(isOutgoingId('66f1a2c9d3e84b7a1c2d3e4f')).toBe(false)
  })
})
