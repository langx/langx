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
