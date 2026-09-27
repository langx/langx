import { describe, expect, it } from 'vitest'
import {
  asksOf,
  createPostSchema,
  legacyKindOf,
  legacySectionOf,
  MAX_POST_LENGTH,
  type PostAsk,
} from './feed'

describe('asksOf', () => {
  it('reads the stored asks when the row has them, empty included', () => {
    expect(asksOf({ asks: ['correction', 'pronunciation'], kind: 'correction' })).toEqual([
      'correction',
      'pronunciation',
    ])
    expect(asksOf({ asks: [], kind: 'moment' })).toEqual([])
  })

  // Every post written before the pronunciation section has no `kind` at all,
  // and every one of them asked for a correction.
  it('reads a row with neither field as a correction ask', () => {
    expect(asksOf({})).toEqual(['correction'])
  })

  it('reads a legacy row from its kind', () => {
    expect(asksOf({ kind: 'correction' })).toEqual(['correction'])
    expect(asksOf({ kind: 'pronunciation' })).toEqual(['pronunciation'])
    expect(asksOf({ kind: 'moment' })).toEqual([])
  })

  it('hands back a copy, so a caller cannot edit the row through it', () => {
    const asks: PostAsk[] = ['correction']
    const read = asksOf({ asks })
    read.push('pronunciation')
    expect(asks).toEqual(['correction'])
  })
})

describe('legacySectionOf', () => {
  it('files a post in the section an installed build finds it in', () => {
    expect(legacySectionOf([])).toBe('moment')
    expect(legacySectionOf(['correction'])).toBe('correction')
    expect(legacySectionOf(['pronunciation'])).toBe('pronunciation')
    // Both asks go to the correction queue, which reaches the most readers.
    expect(legacySectionOf(['correction', 'pronunciation'])).toBe('correction')
  })

  it('round-trips through asksOf for every single-ask and no-ask post', () => {
    for (const asks of [[], ['correction'], ['pronunciation']] as PostAsk[][]) {
      expect(asksOf({ kind: legacySectionOf(asks) })).toEqual(asks)
    }
  })
})

describe('legacyKindOf', () => {
  it('says pronunciation only for a post asking for a recording and nothing else', () => {
    expect(legacyKindOf(['pronunciation'])).toBe('pronunciation')
    expect(legacyKindOf(['correction'])).toBe('correction')
    expect(legacyKindOf(['correction', 'pronunciation'])).toBe('correction')
    // A moment has no section; `'correction'` is a value an old enum has.
    expect(legacyKindOf([])).toBe('correction')
  })
})

describe('createPostSchema', () => {
  it('defaults the kind for a client that predates the pronunciation section', () => {
    const parsed = createPostSchema.parse({ body: 'hi', language: 'en' })
    expect(parsed.kind).toBe('correction')
    expect(parsed.asks).toBeUndefined()
  })

  it('takes none, one or both asks', () => {
    for (const asks of [[], ['correction'], ['pronunciation', 'correction']]) {
      expect(createPostSchema.parse({ body: 'hi', language: 'en', asks }).asks).toEqual(asks)
    }
  })

  it('refuses a repeated ask, an unknown one, and more than exist', () => {
    const parse = (asks: unknown) =>
      createPostSchema.safeParse({ body: 'hi', language: 'en', asks })
    expect(parse(['correction', 'correction']).success).toBe(false)
    expect(parse(['compliment']).success).toBe(false)
    expect(parse(['correction', 'pronunciation', 'correction']).success).toBe(false)
  })

  // Whether an empty caption is allowed depends on the asks and the files,
  // which `createPost` decides; the schema only trims and bounds it.
  it('lets an empty caption through to the rules that decide it', () => {
    expect(createPostSchema.parse({ body: '   ', language: 'en', asks: [] }).body).toBe('')
    expect(
      createPostSchema.safeParse({ body: 'x'.repeat(MAX_POST_LENGTH + 1), language: 'en' }).success,
    ).toBe(false)
  })
})
