import { describe, expect, it } from 'vitest'
import { romanizeDevanagari } from './devanagari'

describe('romanizeDevanagari (Hindi)', () => {
  it('writes a greeting the way it is typed in a chat', () => {
    expect(romanizeDevanagari('नमस्ते, आप कैसे हैं?')).toBe('namaste, aap kaise hain?')
    expect(romanizeDevanagari('मेरा नाम राम है।')).toBe('mera naam raam hai.')
  })

  it('drops a final inherent a, except after a conjunct ending in र य व', () => {
    expect(romanizeDevanagari('भारत कमल दोस्त')).toBe('bhaarat kamal dost')
    expect(romanizeDevanagari('मित्र कार्य')).toBe('mitra kaarya')
    expect(romanizeDevanagari('न')).toBe('na')
  })

  it('drops a medial inherent a between sounded vowels, never twice in a row', () => {
    expect(romanizeDevanagari('कमला अपना')).toBe('kamla apna')
    expect(romanizeDevanagari('समझना')).toBe('samajhna')
  })

  it('shortens a word-final long vowel', () => {
    expect(romanizeDevanagari('हिंदी पानी')).toBe('hindi paani')
  })

  it('writes anusvara as m before a labial and n elsewhere', () => {
    expect(romanizeDevanagari('संभव अंबर हिंदी')).toBe('sambhav ambar hindi')
  })

  it('reads nukta letters, precomposed or combining', () => {
    expect(romanizeDevanagari('क़लम')).toBe('qalam')
    expect(romanizeDevanagari('क़लम')).toBe('qalam')
    expect(romanizeDevanagari('फ़िल्म')).toBe('film')
  })

  it('writes Devanagari digits as digits and leaves the rest alone', () => {
    expect(romanizeDevanagari('१२३ OK 🙏')).toBe('123 OK 🙏')
  })
})
