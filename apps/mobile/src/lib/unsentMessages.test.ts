import { describe, expect, it } from 'vitest'
import { addUnsent, MAX_UNSENT, newClientId, removeUnsent, retireDelivered } from './unsentMessages'

const at = (clientId: string, body = 'hi') => ({ clientId, body, failedAt: '2026-08-31T12:00:00Z' })

describe('addUnsent', () => {
  it('puts the newest first, matching the inverted thread', () => {
    const list = addUnsent(addUnsent([], at('a')), at('b'))
    expect(list.map((m) => m.clientId)).toEqual(['b', 'a'])
  })

  /** A retry that fails again must update its own row, not stack a copy. */
  it('replaces by clientId rather than appending', () => {
    const list = addUnsent(addUnsent([], at('a', 'first')), at('a', 'second'))
    expect(list).toHaveLength(1)
    expect(list[0]?.body).toBe('second')
  })

  it('caps the list so a long offline stretch cannot grow the thread', () => {
    let list = [] as ReturnType<typeof addUnsent>
    for (let i = 0; i < MAX_UNSENT + 5; i++) list = addUnsent(list, at(`m${i}`))
    expect(list).toHaveLength(MAX_UNSENT)
    // The oldest are the ones dropped.
    expect(list[0]?.clientId).toBe(`m${MAX_UNSENT + 4}`)
  })
})

describe('removeUnsent', () => {
  it('drops only the one that finally sent', () => {
    const list = removeUnsent(addUnsent(addUnsent([], at('a')), at('b')), 'a')
    expect(list.map((m) => m.clientId)).toEqual(['b'])
  })

  it('is a no-op for an id that is not there', () => {
    const list = addUnsent([], at('a'))
    expect(removeUnsent(list, 'zzz')).toHaveLength(1)
  })
})

describe('newClientId', () => {
  it('differs for the same instant with different randomness', () => {
    expect(newClientId(1, 0.1)).not.toBe(newClientId(1, 0.2))
  })
})

describe('retireDelivered', () => {
  const list = [at('a'), at('b')]

  /**
   * The case that showed up on screen before this existed: the ack timed out,
   * the message had actually arrived, and the thread showed the same sentence
   * twice — once delivered, once as "not sent".
   */
  it('drops a row whose message did arrive', () => {
    expect(retireDelivered(list, ['a']).map((m) => m.clientId)).toEqual(['b'])
  })

  it('ignores messages with no clientId, which is every older one', () => {
    expect(retireDelivered(list, [undefined, undefined])).toHaveLength(2)
  })

  it('returns the same list when nothing matches', () => {
    expect(retireDelivered(list, ['zzz'])).toHaveLength(2)
  })
})
