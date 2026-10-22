import { describe, expect, it } from 'vitest'
import {
  addUnsent,
  failedSend,
  MAX_UNSENT,
  mergeUnsent,
  MAX_UNSENT_THREADS,
  newClientId,
  readUnsent,
  removeUnsent,
  retireDelivered,
  storeUnsent,
  unsentKey,
  type UnsentByConversation,
  type UnsentMessage,
} from './unsentMessages'

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

describe('storeUnsent', () => {
  const row = (clientId: string): UnsentMessage => ({
    clientId,
    body: 'merhaba',
    failedAt: '2026-09-11T18:00:00.000Z',
  })

  it('keeps the thread just written at the front', () => {
    const stored = storeUnsent({ 'u:b': [row('b1')] }, 'u:a', [row('a1')])
    expect(Object.keys(stored)).toEqual(['u:a', 'u:b'])
  })

  it('drops a thread once its last row has gone', () => {
    expect(storeUnsent({ 'u:a': [row('a1')] }, 'u:a', [])).toEqual({})
  })

  it('remembers only the most recent threads', () => {
    let stored: UnsentByConversation = {}
    for (let i = 0; i < MAX_UNSENT_THREADS + 4; i++) {
      stored = storeUnsent(stored, `u:c${i}`, [row(`m${i}`)])
    }
    expect(Object.keys(stored)).toHaveLength(MAX_UNSENT_THREADS)
    // The newest is kept, the oldest is not.
    expect(stored[`u:c${MAX_UNSENT_THREADS + 3}`]).toBeDefined()
    expect(stored['u:c0']).toBeUndefined()
  })

  /**
   * Rows from before the account was part of the key are never read again,
   * but they are somebody's words and they sat in the record until nine newer
   * threads pushed them out. The first write takes them away.
   */
  it('drops rows stored under a bare conversation id', () => {
    const stored = storeUnsent({ chat1: [row('old')], 'u:b': [row('b1')] }, 'u:a', [row('a1')])
    expect(Object.keys(stored)).toEqual(['u:a', 'u:b'])
  })
})

describe('readUnsent', () => {
  const row: UnsentMessage = {
    clientId: 'x1',
    body: 'are you there',
    failedAt: '2026-10-22T07:54:50.000Z',
  }

  it('gives one account back its own rows', () => {
    const stored = storeUnsent({}, unsentKey('anna', 'chat1'), [row])
    expect(readUnsent(stored, 'anna', 'chat1')).toEqual([row])
  })

  it('never hands one account the other person’s rows in the same conversation', () => {
    // Both people in a conversation share its id; the record is the device's.
    const stored = storeUnsent({}, unsentKey('anna', 'chat1'), [row])
    expect(readUnsent(stored, 'sofia', 'chat1')).toEqual([])
  })

  it('does not read rows stored before they were keyed by account', () => {
    expect(readUnsent({ chat1: [row] }, 'sofia', 'chat1')).toEqual([])
  })

  it('reads nothing from an empty or missing record', () => {
    expect(readUnsent(null, 'sofia', 'chat1')).toEqual([])
    expect(readUnsent({}, 'sofia', 'chat1')).toEqual([])
  })
})

describe('mergeUnsent', () => {
  const row = (clientId: string, failedAt = '2026-10-22T08:00:00.000Z'): UnsentMessage => ({
    clientId,
    body: clientId,
    failedAt,
  })

  /**
   * A send that fails before `me` has loaded is a row in memory before the
   * stored ones arrive. Replacing the list with what was stored threw it away.
   */
  it('keeps a row that failed before the stored ones had loaded', () => {
    const merged = mergeUnsent([row('new', '2026-10-22T09:00:00.000Z')], [row('old')])
    expect(merged.map((r) => r.clientId)).toEqual(['new', 'old'])
  })

  it('keeps the in-memory copy of a row that is in both', () => {
    const fresh = { ...row('x'), failedAt: '2026-10-22T09:00:00.000Z' }
    expect(mergeUnsent([fresh], [row('x')])).toEqual([fresh])
  })

  it('returns the stored rows when nothing failed in memory', () => {
    const stored = [row('a'), row('b')]
    expect(mergeUnsent([], stored)).toEqual(stored)
  })

  it('stays within the ceiling', () => {
    const many = Array.from({ length: MAX_UNSENT }, (_, i) => row(`s${i}`))
    expect(mergeUnsent([row('m')], many)).toHaveLength(MAX_UNSENT)
  })
})

describe('failedSend', () => {
  /**
   * A failed "check my sentence" went into the row without its ask, so a tap
   * on it sent the sentence as a plain message.
   */
  it('keeps the ask, so a retry asks again', () => {
    const row = failedSend({ clientId: 'c', body: 'ich bin', ask: 'correction' }, new Date(0))
    const stored = storeUnsent({}, unsentKey('anna', 'chat1'), [row])
    expect(
      readUnsent(JSON.parse(JSON.stringify(stored)) as UnsentByConversation, 'anna', 'chat1')[0]
        ?.ask,
    ).toBe('correction')
  })

  /** A sent-translated message retried without it arrived untranslated. */
  it('keeps the translation, so a retry sends it again', () => {
    const translation = { text: 'I am', lang: 'en' as const }
    const row = failedSend({ clientId: 'c', body: 'ich bin', translation }, new Date(0))
    const stored = storeUnsent({}, unsentKey('anna', 'chat1'), [row])
    expect(
      readUnsent(JSON.parse(JSON.stringify(stored)) as UnsentByConversation, 'anna', 'chat1')[0]
        ?.translation,
    ).toEqual(translation)
  })

  it('keeps a quote only with the reply it belongs to', () => {
    expect(failedSend({ clientId: 'c', body: 'b', quote: 'q' }, new Date(0))).toEqual({
      clientId: 'c',
      body: 'b',
      failedAt: new Date(0).toISOString(),
    })
    expect(
      failedSend({ clientId: 'c', body: 'b', replyToMessageId: 'm', quote: 'q' }, new Date(0)),
    ).toMatchObject({ replyToMessageId: 'm', quote: 'q' })
  })
})
