import { describe, expect, it } from 'vitest'
import { nameTokens } from './nameTokens'

describe('nameTokens', () => {
  it('gives one lower-cased token per word', () => {
    expect(nameTokens('Ada Lovelace')).toEqual(['ada', 'lovelace'])
  })

  it('breaks on anything that is not a letter or a digit', () => {
    for (const name of ['Ada-Lovelace', 'ada_lovelace', 'Ada  🌸  Lovelace', ' Ada.Lovelace ']) {
      expect(nameTokens(name), name).toEqual(['ada', 'lovelace'])
    }
  })

  it('folds Latin accents, so a name is findable from an ASCII keyboard', () => {
    expect(nameTokens('Özgür Şahin')).toEqual(['ozgur', 'sahin'])
    expect(nameTokens('José Ángel')).toEqual(['jose', 'angel'])
    // Both sides of the comparison run through here, so the searcher typing it
    // the hard way has to land in the same place.
    expect(nameTokens('özgür')).toEqual(nameTokens('Ozgur'))
  })

  it('folds the Turkish dotted capital the way a lower-cased search term does', () => {
    expect(nameTokens('İlker')).toEqual(['ilker'])
    expect(nameTokens('ILKER')).toEqual(['ilker'])
  })

  /**
   * `I` lower-cases to `i` while Turkish writes `ı`, so without a fold the
   * same name gave three tokens: `Işık` → `isık`, `IŞIK` → `isik`, `ışık` →
   * `ısık`. None of the three reached either of the others, and nobody on an
   * ASCII keyboard reached the first.
   */
  it('folds the Turkish dotless i, so case and keyboard stop mattering', () => {
    for (const name of ['Işık', 'IŞIK', 'ışık', 'isik', 'ISIK']) {
      expect(nameTokens(name), name).toEqual(['isik'])
    }
    expect(nameTokens('Sıla Altınkaya')).toEqual(['sila', 'altinkaya'])
  })

  /**
   * Hamza and madda are combining marks once decomposed (U+0653–U+0655), and
   * most people type a name without them: `أحمد` and `احمد` are one name.
   * The short vowels (harakat) are the same story — written in a name now and
   * then, never typed into a search box.
   */
  it('folds Arabic hamza, madda and short vowels onto the bare letters', () => {
    expect(nameTokens('أحمد')).toEqual(nameTokens('احمد'))
    expect(nameTokens('إيمان')).toEqual(nameTokens('ايمان'))
    expect(nameTokens('آمنة')).toEqual(nameTokens('امنة'))
    expect(nameTokens('مُحَمَّد')).toEqual(['محمد'])
  })

  /**
   * The reason only U+0300–U+036F is stripped rather than every combining
   * mark. Taking U+3099 too would store `が` as `か`, which is a different
   * name, not the same one spelled plainly.
   */
  it('leaves kana voicing marks alone', () => {
    expect(nameTokens('がぎ')).toEqual(['がぎ'])
    expect(nameTokens('がぎ')).not.toEqual(nameTokens('かき'))
  })

  it('gives a script without spaces a single token', () => {
    expect(nameTokens('田中太郎')).toEqual(['田中太郎'])
  })

  it('repeats a word once', () => {
    expect(nameTokens('Ali Ali')).toEqual(['ali'])
  })

  it('has nothing to say about an empty name', () => {
    expect(nameTokens('')).toEqual([])
    expect(nameTokens('   ')).toEqual([])
    expect(nameTokens('🌸')).toEqual([])
  })
})
