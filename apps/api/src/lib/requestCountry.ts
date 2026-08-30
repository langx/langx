import { getCountry } from '@langx/shared'
import type { IncomingHttpHeaders } from 'node:http'

/**
 * Which country the request came from, according to the edge.
 *
 * Cloudflare adds `CF-IPCountry` to every proxied request, which is the
 * cheapest correct answer available: no third party sees the user's address,
 * there is no rate limit to run into during a sign-up, and there is no
 * database to keep up to date.
 *
 * **The header alone is worthless.** The Fly origin is still reachable
 * directly by IP, so anyone can send `CF-IPCountry: DE` to it and be German.
 * A Cloudflare transform rule adds a shared secret to every request that
 * really passed through the edge, and the header is only believed when that
 * secret matches. With no secret configured — self-hosting, or a local run —
 * the header is taken at face value, because in that deployment there is no
 * edge to have stripped it and no claim being made about where it came from.
 *
 * `XX` (unknown) and `T1` (Tor) are Cloudflare's own answers for "cannot say".
 * They are not countries and must not be stored as one: onboarding falls back
 * to asking.
 */
export function countryFromHeaders(
  headers: IncomingHttpHeaders,
  edgeSecret: string | undefined,
): string | undefined {
  if (edgeSecret !== undefined && edgeSecret.length > 0) {
    const presented = headers['x-langx-edge']
    if (typeof presented !== 'string' || presented !== edgeSecret) return undefined
  }

  const raw = headers['cf-ipcountry']
  if (typeof raw !== 'string') return undefined
  const code = raw.trim().toUpperCase()
  // `getCountry` is the same table the client's picker draws from, so a code
  // that survives here is one the app can name and filter by.
  return getCountry(code) ? code : undefined
}
