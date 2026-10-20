import { describe, expect, it } from 'vitest'
import {
  captureEchoSchema,
  clampEchoDurationMs,
  ECHO_REVIEW_DURATION_MAX_MS,
  ECHO_SOURCE_KINDS,
  echoSecondsPerCard,
  submitEchoReviewsSchema,
  sourceKeyOf,
  updateEchoCardSchema,
} from './echo'
import { SRS_RULES } from './srs'

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

describe('updateEchoCardSchema, the two files', () => {
  const lines = { front: 'la grenouille', back: 'the frog' }
  const picture = {
    url: 'https://cdn.example.com/echo/u/1.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 4096,
  }

  /*
   * Three states, and the whole reason the field is nullable rather than
   * optional: a client that means "leave it" and one that means "take it off"
   * have to be able to say different things.
   */
  it('tells absent, null and a file apart', () => {
    expect(updateEchoCardSchema.parse(lines).image).toBeUndefined()
    expect(updateEchoCardSchema.parse({ ...lines, image: null }).image).toBeNull()
    expect(updateEchoCardSchema.parse({ ...lines, image: picture }).image).toMatchObject({
      url: picture.url,
    })
  })

  it('takes a file, not a bare URL', () => {
    expect(updateEchoCardSchema.safeParse({ ...lines, image: picture.url }).success).toBe(false)
    expect(updateEchoCardSchema.safeParse({ ...lines, audio: picture.url }).success).toBe(false)
  })

  /* The card's own shape is the server's to build — see `updateCard`. */
  it('does not accept an origin from the client', () => {
    const parsed = updateEchoCardSchema.parse({
      ...lines,
      audio: { ...picture, contentType: 'audio/m4a', origin: 'chat' },
    })
    expect(parsed.audio).not.toHaveProperty('origin')
  })
})

describe('echoSecondsPerCard, how long a card takes', () => {
  const session = (ms: number) => Array.from({ length: SRS_RULES.sessionSize }, () => ms)

  it('says nothing before a session has been answered', () => {
    expect(echoSecondsPerCard([])).toBeNull()
    expect(echoSecondsPerCard(session(8000).slice(1))).toBeNull()
  })

  it('takes the median, so one card left on screen does not move it', () => {
    const answers = [...session(6000).slice(1), 9 * 60 * 1000]
    expect(echoSecondsPerCard(answers)).toBe(6)
  })

  it('averages the middle two of an even count, in whole seconds', () => {
    const answers = [...session(4000).slice(0, 5), ...session(7000).slice(0, 5)]
    expect(echoSecondsPerCard(answers)).toBe(6)
  })

  it('is never zero', () => {
    expect(echoSecondsPerCard(session(120))).toBe(1)
  })
})

describe('a card left on screen', () => {
  const batch = (durationMs: number) => ({
    reviews: [{ reviewId: 'rv-long-0000', cardId: 'c', grade: 'good', durationMs }],
  })

  it('holds a long duration to the ceiling, and leaves a normal one alone', () => {
    expect(clampEchoDurationMs(ECHO_REVIEW_DURATION_MAX_MS + 1)).toBe(ECHO_REVIEW_DURATION_MAX_MS)
    expect(clampEchoDurationMs(4000)).toBe(4000)
  })

  // The batch is the session: refusing it for one card lost every grade in it.
  it('accepts the batch and clamps the card, rather than refusing the batch', () => {
    const parsed = submitEchoReviewsSchema.safeParse(batch(60 * 60 * 1000))
    expect(parsed.success).toBe(true)
    expect(parsed.data?.reviews[0]?.durationMs).toBe(ECHO_REVIEW_DURATION_MAX_MS)
  })

  it('still refuses a negative duration', () => {
    expect(submitEchoReviewsSchema.safeParse(batch(-1)).success).toBe(false)
  })
})
