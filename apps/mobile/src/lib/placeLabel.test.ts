import { describe, expect, it } from 'vitest'
import { placeLabel } from './placeLabel'

const names = (code: string): string => ({ CA: 'Canada', TR: 'Türkiye' })[code] ?? code

describe('placeLabel', () => {
  it('puts the flag in front of the city, and leaves the country name out', () => {
    expect(placeLabel({ city: 'Toronto', country: 'CA' }, names)).toBe('🇨🇦 Toronto')
  })

  it('names the country when there is no city', () => {
    expect(placeLabel({ country: 'TR' }, names)).toBe('🇹🇷 Türkiye')
  })

  it('is nothing when nothing is known', () => {
    expect(placeLabel({}, names)).toBeUndefined()
  })

  it('does not invent a flag for a code the list does not know', () => {
    expect(placeLabel({ city: 'Somewhere', country: 'ZZ' }, names)).toBe('Somewhere')
    expect(placeLabel({ country: 'ZZ' }, names)).toBe('ZZ')
  })
})
