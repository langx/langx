import { describe, expect, it } from 'vitest'
import { deckCsv } from './deckCsv'
import type { PhraseCardDto } from '../api/queries'

function card(over: Partial<PhraseCardDto> = {}): PhraseCardDto {
  return {
    _id: '1',
    messageId: 'm1',
    authorId: 'a',
    term: 'kolay gelsin',
    meaning: 'may it come easily',
    lang: 'tr',
    createdAt: '2026-09-07T00:00:00.000Z',
    ...over,
  }
}

describe('deckCsv', () => {
  it('writes term, meaning and example in the order Anki maps them', () => {
    expect(deckCsv([card({ example: 'Kolay gelsin!' })])).toBe(
      '"kolay gelsin","may it come easily","Kolay gelsin!"\r\n',
    )
  })

  it('leaves the example column empty rather than dropping it', () => {
    // A short row would shift the next card's meaning into the example column.
    expect(deckCsv([card()])).toBe('"kolay gelsin","may it come easily",""\r\n')
  })

  /** A phrase is somebody's sentence: all three of these are ordinary in one. */
  it('quotes commas, quotation marks and newlines instead of breaking the row', () => {
    const ics = deckCsv([
      card({ term: 'a, b', meaning: 'she said "hi"', example: 'line one\nline two' }),
    ])
    expect(ics).toBe('"a, b","she said ""hi""","line one\nline two"\r\n')
  })

  it('gives an empty deck an empty file, not a blank line', () => {
    expect(deckCsv([])).toBe('')
  })
})
