import { describe, expect, it } from 'vitest'
import { matchRanges, searchSnippet } from './searchSnippet'

describe('matchRanges', () => {
  it('finds every occurrence, ignoring case', () => {
    expect(matchRanges('Berlin, then BERLIN again', 'berlin')).toEqual([
      { start: 0, end: 6 },
      { start: 13, end: 19 },
    ])
  })

  it('does not overlap one match with the next', () => {
    expect(matchRanges('aaaa', 'aa')).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 4 },
    ])
  })

  /** The term is text, not a pattern: nothing here is a wildcard. */
  it('treats regex metacharacters as themselves', () => {
    expect(matchRanges('abc and a.c', 'a.c')).toEqual([{ start: 8, end: 11 }])
    expect(matchRanges('(a+)+$', '(a+)+$')).toEqual([{ start: 0, end: 6 }])
    expect(matchRanges('anything', '.*')).toEqual([])
  })

  it('highlights nothing rather than the wrong letters when case changes a length', () => {
    // `'İ'.toLowerCase()` is two code units; every offset after it would shift.
    expect(matchRanges('İstanbul gezisi', 'gezi')).toEqual([])
  })

  it('matches nothing for an empty term', () => {
    expect(matchRanges('hello', '')).toEqual([])
  })
})

describe('searchSnippet', () => {
  const joined = (parts: { text: string }[]) => parts.map((part) => part.text).join('')

  it('splits a short message into plain and matched runs', () => {
    expect(searchSnippet('See you in Berlin!', 'berlin')).toEqual([
      { text: 'See you in ', match: false },
      { text: 'Berlin', match: true },
      { text: '!', match: false },
    ])
  })

  it('folds line breaks so the row does not spend its lines on them', () => {
    expect(joined(searchSnippet('first line\n\nsecond   line', 'second'))).toBe(
      'first line second line',
    )
  })

  it('still highlights a term the server matched across a line break', () => {
    const parts = searchSnippet('see you\ntomorrow', 'you\ntomorrow')
    expect(parts.filter((part) => part.match).map((part) => part.text)).toEqual(['you tomorrow'])
  })

  it('cuts the lead of a long message at a word, so the match is in view', () => {
    const body = `${'lorem ipsum dolor sit amet '.repeat(4)}the needle here`
    const parts = searchSnippet(body, 'needle')
    expect(parts[0]).toEqual({ text: '…', match: false })
    const text = joined(parts)
    expect(text.indexOf('needle')).toBeLessThanOrEqual(30)
    // Starts on a whole word.
    expect(body).toContain(` ${text.slice(1).split(' ')[0]} `)
  })

  it('never starts between the halves of an emoji', () => {
    // The odd 'x', and no space to snap to, put the cut on a low surrogate.
    const body = `${'😀'.repeat(20)}xneedle`
    const text = joined(searchSnippet(body, 'needle')).slice(1)
    const code = text.charCodeAt(0)
    expect(code >= 0xdc00 && code <= 0xdfff).toBe(false)
  })

  it('shows the message unhighlighted when nothing matches locally', () => {
    expect(searchSnippet('İstanbul', 'istanbul')).toEqual([{ text: 'İstanbul', match: false }])
  })
})
