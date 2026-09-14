import { describe, expect, it } from 'vitest'
import { captureEchoSchema, ECHO_SOURCE_KINDS, sourceKeyOf } from './echo'

describe('sourceKeyOf', () => {
  it('names what each card was made from', () => {
    expect(sourceKeyOf({ kind: 'chat', conversationId: 'c', messageId: 'm', partnerId: 'p' })).toBe(
      'msg:m',
    )
    expect(sourceKeyOf({ kind: 'post', postId: 'p', authorId: 'a' })).toBe('post:p')
    expect(sourceKeyOf({ kind: 'phrase', phraseCardId: 'f', conversationId: 'c' })).toBe('phrase:f')
    expect(sourceKeyOf({ kind: 'pack', packId: 'fr:beginner', itemId: 'i' })).toBe('pack:i')
  })

  /*
   * The one source with nothing behind it, and the reason it carries an id at
   * all: without one every hand-written card would share a key and
   * `card_source_unique` would allow exactly one per person.
   */
  it('keeps hand-written cards apart by the id they bring', () => {
    expect(sourceKeyOf({ kind: 'manual', id: 'abc' })).toBe('manual:abc')
    expect(sourceKeyOf({ kind: 'manual', id: 'abc' })).not.toBe(
      sourceKeyOf({ kind: 'manual', id: 'xyz' }),
    )
  })

  it('has a key for every kind it says exists', () => {
    expect(ECHO_SOURCE_KINDS).toContain('manual')
  })
})

describe('captureEchoSchema, writing a card by hand', () => {
  const manual = { clientId: 'abcdefgh', front: 'la grenouille', lang: 'fr' }

  it('takes a sentence, a language and the id that makes the save idempotent', () => {
    const parsed = captureEchoSchema.parse({ source: { kind: 'manual', ...manual } })
    expect(parsed.source).toMatchObject({ kind: 'manual', front: 'la grenouille', lang: 'fr' })
  })

  /* Absent asks for a translation; empty would ask for a card with no back. */
  it('refuses an empty back rather than treating it as absent', () => {
    expect(
      captureEchoSchema.safeParse({ source: { kind: 'manual', ...manual, back: '' } }).success,
    ).toBe(false)
    expect(
      captureEchoSchema.safeParse({ source: { kind: 'manual', ...manual, back: 'the frog' } })
        .success,
    ).toBe(true)
  })

  it('refuses a language this build has no name for, and a front with nothing in it', () => {
    expect(
      captureEchoSchema.safeParse({ source: { kind: 'manual', ...manual, lang: 'zz' } }).success,
    ).toBe(false)
    expect(
      captureEchoSchema.safeParse({ source: { kind: 'manual', ...manual, front: '   ' } }).success,
    ).toBe(false)
  })

  it('refuses a client id too short to be one', () => {
    expect(
      captureEchoSchema.safeParse({ source: { kind: 'manual', ...manual, clientId: 'abc' } })
        .success,
    ).toBe(false)
  })
})
