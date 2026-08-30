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
