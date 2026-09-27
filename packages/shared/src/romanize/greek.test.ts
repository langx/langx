import { describe, expect, it } from 'vitest'
import { romanizeGreek } from './greek'

describe('romanizeGreek (ELOT 743, simplified)', () => {
  it('writes the letters and drops the accents', () => {
    expect(romanizeGreek('Καλημέρα! Τι κάνεις;')).toBe('Kalimera! Ti kaneis;')
    expect(romanizeGreek('Ελλάδα')).toBe('Ellada')
  })

  it('writes αυ ευ as v before a voiced sound and f before a voiceless one', () => {
    expect(romanizeGreek('αύριο ευρώ')).toBe('avrio evro')
    expect(romanizeGreek('αυτό Ευχαριστώ')).toBe('afto Efcharisto')
    expect(romanizeGreek('ουρανός')).toBe('ouranos')
  })

  it('says μπ ντ γκ as b d g at the start of a word and mb nd ng inside', () => {
    expect(romanizeGreek('μπαμπάς')).toBe('bambas')
    expect(romanizeGreek('ντομάτα πέντε')).toBe('domata pende')
    expect(romanizeGreek('γκρίζο άγκυρα')).toBe('grizo angyra')
    expect(romanizeGreek('άγγελος')).toBe('angelos')
  })

  it('lets a diaeresis break a pair', () => {
    expect(romanizeGreek('τρόλεϊ προϋπόθεση')).toBe('trolei proypothesi')
  })

  it('keeps capitals and passes other characters through', () => {
    expect(romanizeGreek('ΑΘΗΝΑ Θεσσαλονίκη')).toBe('ATHINA Thessaloniki')
    expect(romanizeGreek('OK 2 φορές 👍')).toBe('OK 2 fores 👍')
  })

  it('reduces polytonic letters to their base', () => {
    expect(romanizeGreek('ἄνθρωπος')).toBe('anthropos')
  })
})
