/**
 * The address a product page's link card prints under its name, from the URL
 * the card opens — `https://token.langx.io/tr/` reads "token.langx.io/tr".
 *
 * Derived rather than passed in beside the URL, so the address a person reads
 * is always the one they are taken to: a card that says one site and opens
 * another is exactly what a page about trust cannot have. The scheme and a
 * trailing slash are dropped because they say nothing a reader needs; the
 * path stays, because `/tr` is the reader's own language and worth seeing.
 */
export function linkAddress(url: string): string {
  return url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/\/+$/, '')
}

/**
 * A product's colour washed thin, as `#rrggbbaa`: the quiet field its mark
 * stands on. Laid over the ground, so it is the palette's own hue at a
 * fraction rather than a new colour to keep in step — the form
 * `inkTrack` already draws a track in.
 */
export function toneWash(hex: string, strength: number): string {
  const alpha = Math.round(Math.min(Math.max(strength, 0), 1) * 255)
  return `${hex}${alpha.toString(16).padStart(2, '0')}`
}
