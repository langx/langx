import { describe, expect, it } from 'vitest'
import { englishBarLabel, englishCount } from './chartWords'

/**
 * The operator panel's chart words, held to exactly what `BarList` wrote
 * before it took a formatter for the Transparency page. The panel passes
 * neither, so these defaults are its output byte for byte: English grouping
 * on screen, and the bare number in what a screen reader hears.
 */
describe('BarList’s defaults, which are the operator panel’s', () => {
  it('groups a value in English whatever language the app is in', () => {
    expect(englishCount(12345)).toBe('12,345')
    expect(englishCount(845)).toBe('845')
    expect(englishCount(1_234_567)).toBe('1,234,567')
  })

  it('reads a row as its label, the bare number and the hint', () => {
    expect(englishBarLabel({ label: 'Spanish', value: 12345, hint: '4%' })).toBe(
      'Spanish: 12345, 4%',
    )
    expect(englishBarLabel({ label: 'Spanish', value: 12345 })).toBe('Spanish: 12345')
  })
})
