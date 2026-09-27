import { describe, expect, it } from 'vitest'
import { romanizeHangul } from './hangul'

describe('romanizeHangul (Revised Romanization)', () => {
  it('decomposes syllable blocks', () => {
    expect(romanizeHangul('안녕하세요')).toBe('annyeonghaseyo')
    expect(romanizeHangul('라면')).toBe('ramyeon')
  })

  it('links a final into a following silent ㅇ', () => {
    expect(romanizeHangul('한국어')).toBe('hangugeo')
    expect(romanizeHangul('없어 값이')).toBe('eopseo gapsi')
    expect(romanizeHangul('좋아 많이')).toBe('joa mani')
  })

  it('palatalises ㄷ ㅌ before 이', () => {
    expect(romanizeHangul('같이 굳이')).toBe('gachi guji')
  })

  it('nasalises k t p before ㄴ ㅁ', () => {
    expect(romanizeHangul('감사합니다')).toBe('gamsahamnida')
    expect(romanizeHangul('국물')).toBe('gungmul')
  })

  it('applies the ㄹ rules', () => {
    expect(romanizeHangul('신라 설날 달리')).toBe('silla seollal dalli')
    expect(romanizeHangul('종로 협력')).toBe('jongno hyeomnyeok')
  })

  it('aspirates after ㅎ', () => {
    expect(romanizeHangul('좋다 놓는')).toBe('jota nonneun')
  })

  it('does not carry a rule across a space', () => {
    expect(romanizeHangul('밥 먹어')).toBe('bap meogeo')
  })

  it('writes lone jamo and passes everything else through', () => {
    expect(romanizeHangul('ㅋㅋㅋ ㅠㅠ')).toBe('kkk yuyu')
    expect(romanizeHangul('BTS 최고! 100%')).toBe('BTS choego! 100%')
  })
})
