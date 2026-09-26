import { describe, expect, it } from 'vitest'
import { splitSentences, splitWords } from './sentences'

describe('splitSentences', () => {
  it('cuts after each full stop, question and exclamation mark, keeping it', () => {
    expect(splitSentences('I went home. Did you? It was great!')).toEqual([
      'I went home.',
      'Did you?',
      'It was great!',
    ])
  })

  it('keeps a run of punctuation and an ellipsis with their sentence', () => {
    expect(splitSentences('Really?! I thought so… Well...  fine')).toEqual([
      'Really?!',
      'I thought so…',
      'Well...',
      'fine',
    ])
  })

  it('cuts Chinese and Japanese without the space those languages never write', () => {
    expect(splitSentences('我很好。你呢？太好了！')).toEqual(['我很好。', '你呢？', '太好了！'])
    expect(splitSentences('今日は暑いです。本当に？')).toEqual(['今日は暑いです。', '本当に？'])
  })

  it('leaves a decimal and a domain whole', () => {
    expect(splitSentences('It costs 3.50 on langx.io today')).toEqual([
      'It costs 3.50 on langx.io today',
    ])
  })

  it('takes a closing quote or bracket along with the sentence it closes', () => {
    expect(splitSentences('She said "no." Then she left.')).toEqual([
      'She said "no."',
      'Then she left.',
    ])
  })

  it('treats a line break as the end of a sentence', () => {
    expect(splitSentences('first line\nsecond line')).toEqual(['first line', 'second line'])
  })

  it('never offers a piece with no words in it', () => {
    expect(splitSentences('Hi! ?')).toEqual(['Hi! ?'])
    expect(splitSentences('?! Hello there.')).toEqual(['?! Hello there.'])
    expect(splitSentences('   ')).toEqual([])
    expect(splitSentences('')).toEqual([])
  })

  it('still gives back a message that has no words at all', () => {
    expect(splitSentences('😂😂')).toEqual(['😂😂'])
  })

  it('returns pieces that are all substrings of the text, as the server requires', () => {
    const text = '  Merhaba!  Nasılsın?\n\nBen iyiyim… 我很好。 ok  '
    const parts = splitSentences(text)
    expect(parts).toHaveLength(5)
    for (const part of parts) {
      expect(text.includes(part)).toBe(true)
      expect(part).toBe(part.trim())
    }
  })
})

/*
 * The server runs these on text anybody can send, so a hostile message must
 * cost time in proportion to its length. The limit is generous because a CI
 * machine is busy: a linear pass over 50,000 characters takes a few
 * milliseconds, and the regular expression this replaced took ten seconds.
 */
describe('on a long hostile message', () => {
  const HOSTILE = [
    '!'.repeat(50_000),
    '.'.repeat(50_000),
    '!?.…'.repeat(12_500),
    `${'!'.repeat(50_000)}x`,
    '! '.repeat(25_000),
    `a${'!)'.repeat(25_000)}b`,
    `${"a'".repeat(25_000)}`,
  ]

  it('splits in linear time', () => {
    for (const text of HOSTILE) {
      const started = Date.now()
      splitSentences(text)
      splitWords(text)
      expect(Date.now() - started, text.slice(0, 8)).toBeLessThan(250)
    }
  })

  it('still reads a run of punctuation as one piece', () => {
    expect(splitSentences('!'.repeat(50_000))).toEqual(['!'.repeat(50_000)])
    expect(splitSentences(`Hi${'!'.repeat(1000)} there`)).toEqual([
      `Hi${'!'.repeat(1000)}`,
      'there',
    ])
  })
})

describe('splitWords', () => {
  it('finds words and keeps apostrophes inside them', () => {
    expect(splitWords("I don't know, l'eau is 2 cold!")).toEqual([
      'I',
      "don't",
      'know',
      "l'eau",
      'is',
      '2',
      'cold',
    ])
  })

  it('keeps accents, combining marks and non-Latin letters in the word', () => {
    expect(splitWords('Günaydın, नमस्ते привет')).toEqual(['Günaydın', 'नमस्ते', 'привет'])
  })

  it('cuts Chinese and Japanese one character at a time', () => {
    expect(splitWords('我爱你')).toEqual(['我', '爱', '你'])
    expect(splitWords('コーヒーを飲む')).toEqual(['コ', 'ー', 'ヒ', 'ー', 'を', '飲', 'む'])
  })

  it('splits Latin text that runs straight into CJK', () => {
    expect(splitWords('iPhone很好')).toEqual(['iPhone', '很', '好'])
  })

  it('keeps Korean words whole, since Korean spaces them', () => {
    expect(splitWords('안녕하세요 친구')).toEqual(['안녕하세요', '친구'])
  })

  it('finds nothing in punctuation and emoji', () => {
    expect(splitWords('?! 😂 ...')).toEqual([])
  })
})
