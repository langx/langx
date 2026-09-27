import { LOCATION_LABEL_MAX_LENGTH } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { coordinatesText, mapsUrl, placeLabel } from './sharedLocation'

const MODA = {
  name: 'Moda Cd. No:12',
  street: 'Moda Cd.',
  streetNumber: '12',
  district: 'Kadıköy',
  subregion: 'Kadıköy',
  city: 'İstanbul',
  region: 'İstanbul',
  country: 'Türkiye',
}

describe('placeLabel', () => {
  it('names only the area when approximate', () => {
    expect(placeLabel(MODA, 'approximate')).toBe('Kadıköy, İstanbul')
  })

  it('names the street as well when exact', () => {
    expect(placeLabel(MODA, 'exact')).toBe('Moda Cd. 12, Kadıköy, İstanbul')
  })

  /** A street has no business on an approximate card, whatever else is missing. */
  it('falls back to the country rather than a street', () => {
    const rural = { name: 'Köy Yolu 3', street: 'Köy Yolu', country: 'Türkiye' }
    expect(placeLabel(rural, 'approximate')).toBe('Türkiye')
  })

  it('has nothing to say when the geocoder had nothing', () => {
    expect(placeLabel(undefined, 'exact')).toBeUndefined()
    expect(placeLabel({}, 'approximate')).toBeUndefined()
    expect(placeLabel({ city: '  ' }, 'approximate')).toBeUndefined()
  })

  it('fits what the server accepts', () => {
    const long = { city: 'a'.repeat(200) }
    expect(placeLabel(long, 'approximate')?.length).toBe(LOCATION_LABEL_MAX_LENGTH)
  })
})

describe('coordinatesText', () => {
  it('shows as many decimals as the precision kept', () => {
    expect(coordinatesText({ lat: 40.99, lng: 29.02 }, 'approximate')).toBe('40.99, 29.02')
    expect(coordinatesText({ lat: 40.991234, lng: -3.7 }, 'exact')).toBe('40.99123, -3.70000')
  })
})

describe('mapsUrl', () => {
  const point = { lat: 40.99, lng: 29.02, label: 'Kadıköy, İstanbul' }

  it('opens Apple Maps on iOS, with the place name as the pin', () => {
    expect(mapsUrl(point, 'ios')).toBe(
      'https://maps.apple.com/?ll=40.99,29.02&q=Kad%C4%B1k%C3%B6y%2C%20%C4%B0stanbul',
    )
  })

  it('opens Google Maps everywhere else', () => {
    for (const os of ['android', 'web']) {
      expect(mapsUrl(point, os)).toBe(
        'https://www.google.com/maps/search/?api=1&query=40.99%2C29.02',
      )
    }
  })
})
