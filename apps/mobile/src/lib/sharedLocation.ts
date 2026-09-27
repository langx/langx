import { LOCATION_LABEL_MAX_LENGTH, type SharedLocationPrecision } from '@langx/shared'

/**
 * A place shared in a chat: what to call it, and where "Open in Maps" goes.
 *
 * Pure on purpose — no `react-native`, no `expo-location` — so the vitest run
 * can reach it. The caller passes the platform and the address it resolved.
 */

export interface SharedPoint {
  lat: number
  lng: number
  label?: string
}

/**
 * The fields of `expo-location`'s geocoded address this reads, spelled out
 * rather than imported so the test does not load the native module.
 */
export interface GeocodedAddress {
  name?: string | null
  street?: string | null
  streetNumber?: string | null
  district?: string | null
  subregion?: string | null
  city?: string | null
  region?: string | null
  country?: string | null
}

/** Joins what is there, once each: iOS often reports the same town as city and region. */
function joinParts(parts: (string | null | undefined)[]): string | undefined {
  const seen: string[] = []
  for (const part of parts) {
    const trimmed = part?.trim()
    if (trimmed && !seen.includes(trimmed)) seen.push(trimmed)
  }
  const joined = seen.join(', ').slice(0, LOCATION_LABEL_MAX_LENGTH).trim()
  return joined || undefined
}

/**
 * The name the card shows, resolved on the sender's device when they send.
 *
 * Approximate names the area and nothing finer — the neighbourhood and the
 * town — because a street on a card that says "approximate" would undo the
 * rounding the server does to the point. Exact names the street as well.
 * `undefined` when the geocoder had nothing, and the card falls back to the
 * coordinates.
 */
export function placeLabel(
  address: GeocodedAddress | undefined,
  precision: SharedLocationPrecision,
): string | undefined {
  if (!address) return undefined
  const area = address.district ?? address.subregion
  const town = address.city ?? address.region
  if (precision === 'approximate') {
    return joinParts([area, town]) ?? joinParts([address.country])
  }
  const street = address.street
    ? [address.street, address.streetNumber].filter(Boolean).join(' ')
    : address.name
  return joinParts([street, area, town])
}

/**
 * The fallback when there is no place name. As many decimals as were kept:
 * two for approximate, since that is all the server stored, and five for
 * exact, about a metre, which is finer than any phone's fix.
 */
export function coordinatesText(point: SharedPoint, precision: SharedLocationPrecision): string {
  const digits = precision === 'approximate' ? 2 : 5
  return `${point.lat.toFixed(digits)}, ${point.lng.toFixed(digits)}`
}

/**
 * "Open in Maps": Apple Maps on iOS, Google Maps everywhere else.
 *
 * Both are https links rather than a `maps:` or `geo:` scheme, so no map
 * provider, no key and no native module is involved: iOS hands Apple's to the
 * Maps app, Android hands Google's to its app when it is installed, and a
 * browser simply opens the page.
 */
export function mapsUrl(point: SharedPoint, os: string): string {
  const at = `${point.lat},${point.lng}`
  if (os === 'ios') {
    return `https://maps.apple.com/?ll=${at}&q=${encodeURIComponent(point.label ?? at)}`
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(at)}`
}
