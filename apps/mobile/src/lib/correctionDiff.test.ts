import { describe, expect, it } from 'vitest'
import { diffCorrection, type DiffSegment } from './correctionDiff'

const join = (segments: DiffSegment[]): string => segments.map((s) => s.text).join('')
const changed = (segments: DiffSegment[]): string[] =>
  segments.filter((s) => s.changed).map((s) => s.text)

describe('diffCorrection', () => {
  it('marks only the word that was replaced', () => {
    const diff = diffCorrection('I go to school yesterday', 'I went to school yesterday')
    expect(changed(diff.original)).toEqual(['go'])
    expect(changed(diff.corrected)).toEqual(['went'])
  })

  it('marks an inserted word on the corrected side only', () => {
    const diff = diffCorrection('I going home', 'I am going home')
    expect(changed(diff.original)).toEqual([])
    expect(changed(diff.corrected)).toEqual(['am'])
  })

  it('marks a removed word on the original side only', () => {
    const diff = diffCorrection('I did not went there', 'I did not go there')
    expect(changed(diff.original)).toEqual(['went'])
    expect(changed(diff.corrected)).toEqual(['go'])
  })

  it('keeps two separate changes separate rather than merging the span between them', () => {
    const diff = diffCorrection(
      'she have a car and he have a bike',
      'she has a car and he has a bike',
    )
    // `have` → `has` shares `ha`, so the character pass narrows both of them.
    expect(changed(diff.original)).toEqual(['ve', 've'])
    expect(changed(diff.corrected)).toEqual(['s', 's'])
    expect(join(diff.original)).toBe('she have a car and he have a bike')
  })

  /**
   * The Turkish case, and the reason the character pass exists: the mistake is
   * a suffix, and colouring the whole word would hide which part of it moved.
   */
  it('narrows a one-word swap to the letters that differ', () => {
    const diff = diffCorrection('yarın okula gidiyom', 'yarın okula gidiyorum')
    expect(changed(diff.original)).toEqual([])
    expect(changed(diff.corrected)).toEqual(['ru'])
    expect(join(diff.corrected)).toBe('yarın okula gidiyorum')
  })

  it('narrows a punctuation fix to the punctuation', () => {
    const diff = diffCorrection('thanks a lot', 'thanks a lot!')
    expect(changed(diff.original)).toEqual([])
    expect(changed(diff.corrected)).toEqual(['!'])
  })

  it('keeps two genuinely different words whole rather than splitting letters', () => {
    const diff = diffCorrection('a big house', 'a large house')
    expect(changed(diff.original)).toEqual(['big'])
    expect(changed(diff.corrected)).toEqual(['large'])
  })

  /**
   * Chinese and Japanese arrive as one token per side, so the word pass has
   * nothing to align — the character pass is the only one that can say
   * anything, and it does.
   */
  it('says something useful about text written without spaces', () => {
    const diff = diffCorrection('我昨天去学校', '我昨天去了学校')
    expect(changed(diff.original)).toEqual([])
    expect(changed(diff.corrected)).toEqual(['了'])
  })

  /**
   * Punctuation is its own token. Split on whitespace alone, `coffee` and
   * `coffee,` were two different words, and a correction that only added
   * `, please` drew `coffee` as deleted and typed again.
   */
  it('marks punctuation added after a word without redrawing the word', () => {
    const diff = diffCorrection(
      'I would like a cup of coffee',
      'I would like a cup of coffee, please',
    )
    expect(changed(diff.original)).toEqual([])
    expect(changed(diff.corrected)).toEqual([', please'])
    expect(join(diff.corrected)).toBe('I would like a cup of coffee, please')
  })

  it('marks a trailing exclamation mark on its own', () => {
    const diff = diffCorrection('Hello', 'Hello!')
    expect(changed(diff.original)).toEqual([])
    expect(changed(diff.corrected)).toEqual(['!'])
  })

  it('marks a comma inserted mid-sentence and leaves the words around it alone', () => {
    const diff = diffCorrection('Yes I know', 'Yes, I know')
    expect(changed(diff.original)).toEqual([])
    expect(changed(diff.corrected)).toEqual([','])
    expect(join(diff.original)).toBe('Yes I know')
    expect(join(diff.corrected)).toBe('Yes, I know')
  })

  it('marks a word changed before a full stop without the full stop', () => {
    const diff = diffCorrection('I have a cat.', 'I have a dog.')
    expect(changed(diff.original)).toEqual(['cat'])
    expect(changed(diff.corrected)).toEqual(['dog'])
  })

  it('marks a removed comma on the original side only', () => {
    const diff = diffCorrection('Hello, world', 'Hello world')
    expect(changed(diff.original)).toEqual([','])
    expect(changed(diff.corrected)).toEqual([])
  })

  it('treats the Spanish opening marks as punctuation of their own', () => {
    const diff = diffCorrection('Dónde está el baño', '¿Dónde está el baño?')
    expect(changed(diff.original)).toEqual([])
    expect(changed(diff.corrected)).toEqual(['¿', '?'])
  })

  it('treats Arabic punctuation as punctuation', () => {
    const question = diffCorrection('كيف حالك', 'كيف حالك؟')
    expect(changed(question.original)).toEqual([])
    expect(changed(question.corrected)).toEqual(['؟'])

    const latinMark = diffCorrection('كيف حالك?', 'كيف حالك؟')
    expect(changed(latinMark.original)).toEqual(['?'])
    expect(changed(latinMark.corrected)).toEqual(['؟'])

    const comma = diffCorrection('نعم أعرف', 'نعم، أعرف')
    expect(changed(comma.original)).toEqual([])
    expect(changed(comma.corrected)).toEqual(['،'])
  })

  it('marks Cyrillic punctuation on its own', () => {
    const diff = diffCorrection('Как дела', 'Как дела?')
    expect(changed(diff.corrected)).toEqual(['?'])
  })

  /**
   * An apostrophe or a hyphen between two letters is part of the word. Split
   * out, `dont → don't` would be one word against three tokens and redrawn
   * whole; kept in, the character pass narrows it to the apostrophe.
   */
  it.each([
    ['I dont know', "I don't know", "'"],
    ['I dont know', 'I don’t know', '’'],
    ['je bois leau', "je bois l'eau", "'"],
    ['İstanbula gidiyorum', "İstanbul'a gidiyorum", "'"],
    ['a wellknown fact', 'a well-known fact', '-'],
  ])('keeps an apostrophe or hyphen inside its word: %j → %j', (original, corrected, mark) => {
    const diff = diffCorrection(original, corrected)
    expect(changed(diff.original)).toEqual([])
    expect(changed(diff.corrected)).toEqual([mark])
  })

  it('narrows an accent fix to the letter, with the full stop left alone', () => {
    const diff = diffCorrection('un cafe.', 'un café.')
    expect(changed(diff.original)).toEqual(['e'])
    expect(changed(diff.corrected)).toEqual(['é'])
  })

  /**
   * An accent typed as a combining character is two code units. Cutting
   * between them would draw the accent alone, as a dotted circle.
   */
  it('never splits a combining accent from its letter', () => {
    const diff = diffCorrection('un cafe au lait', 'un cafe\u0301 au lait')
    expect(changed(diff.original)).toEqual(['e'])
    expect(changed(diff.corrected)).toEqual(['e\u0301'])
  })

  it('never splits a surrogate pair', () => {
    const diff = diffCorrection('nice 😀', 'nice 😃')
    expect(changed(diff.original)).toEqual(['😀'])
    expect(changed(diff.corrected)).toEqual(['😃'])
  })

  /**
   * Text without spaces is split at its own punctuation now, so two edits in
   * two clauses are narrowed one clause at a time — before, the character pass
   * saw the whole message as one word and coloured everything between them.
   */
  it('narrows each clause of text written without spaces separately', () => {
    const diff = diffCorrection('我去学校，他在家。', '我去了学校，他不在家。')
    expect(changed(diff.original)).toEqual([])
    expect(changed(diff.corrected)).toEqual(['了', '不'])
  })

  it('leaves an unchanged sentence unmarked', () => {
    const diff = diffCorrection('all good here', 'all good here')
    expect(changed(diff.original)).toEqual([])
    expect(changed(diff.corrected)).toEqual([])
    expect(join(diff.original)).toBe('all good here')
  })

  it('never strikes the whitespace after a changed word', () => {
    const diff = diffCorrection('I go home', 'I run home')
    for (const segment of [...diff.original, ...diff.corrected]) {
      if (segment.changed) expect(segment.text).toBe(segment.text.trim())
    }
  })

  /**
   * The invariant everything else rests on: whatever the diff decides, the
   * pieces still spell the two sentences. A bug here would silently drop a
   * word from a message on screen.
   */
  it.each([
    ['I go to school yesterday', 'I went to school yesterday'],
    ['  leading and trailing  ', 'leading and trailing'],
    ['line one\nline two', 'line   one\nline two!'],
    ['', 'a whole sentence appeared'],
    ['everything was deleted', ''],
    ['我昨天去学校', '我昨天去了学校'],
    ['one', 'completely different words entirely'],
    ['I would like a cup of coffee', 'I would like a cup of coffee, please'],
    ['Hello , world !', 'Hello, world!'],
    ['  Dónde está el baño  ', '¿Dónde está el baño?\n'],
    ['كيف حالك?', 'كيف حالك؟'],
    ['我去学校，他在家。', '我去了学校，他不在家。'],
    ["don't stop", 'do not stop!!'],
    ['«Bonjour»', '« Bonjour ! »'],
    ['nice 😀', 'nice 😃 ❤️'],
  ])('joins back to exactly what went in: %j → %j', (original, corrected) => {
    const diff = diffCorrection(original, corrected)
    expect(join(diff.original)).toBe(original)
    expect(join(diff.corrected)).toBe(corrected)
  })

  it('gives up on pathological input rather than building a huge table', () => {
    const long = Array.from({ length: 800 }, (_, i) => `w${i}`).join(' ')
    const diff = diffCorrection(long, `${long} more`)
    expect(diff.original).toHaveLength(1)
    expect(diff.corrected).toHaveLength(1)
    expect(join(diff.corrected)).toBe(`${long} more`)
  })
})
