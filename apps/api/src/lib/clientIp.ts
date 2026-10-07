import type { IncomingHttpHeaders } from 'node:http'
import { BlockList, isIPv4, isIPv6 } from 'node:net'

/**
 * The client's address, as the API resolved it, carried across the bridge
 * into Better Auth — the one place everything in Better Auth reads an address
 * from: its rate limiter, `session.ipAddress`, and the sign-up cap.
 *
 * Better Auth's handlers see a Fetch `Request` built from the incoming
 * headers, and a `Request` has no socket — so `routes/auth.ts` writes
 * {@link resolveClientIp}'s answer here. It is `set`, never appended, and
 * deleted when there is no answer, so whatever a client sends under the same
 * name is never what is read.
 *
 * Better Auth's own default, `X-Forwarded-For`, does not work here: without a
 * list of trusted proxies it gives up on any header holding more than one
 * address, and behind Cloudflare and Fly that header always holds two. Every
 * request then had no address at all — sessions recorded none, and the rate
 * limiter counted everybody in one bucket per route.
 */
export const CLIENT_IP_HEADER = 'x-langx-client-ip'

/**
 * Where a request came from, or `undefined` when there is nothing to go on.
 *
 * `CF-Connecting-IP` when the request proves it passed through the edge — the
 * same shared-secret check `requestCountry.ts` makes before it believes
 * `CF-IPCountry`. Otherwise the address Fastify resolved (`request.ip`, through
 * `trustProxy` in production), which is what the API's own rate limiter keys
 * on. Unlike the country, Cloudflare's header is not taken at face value when
 * no secret is configured: the origin can be reached without passing through
 * Cloudflare, and a header the edge did not vouch for may have come from the
 * client.
 */
export function resolveClientIp(
  headers: IncomingHttpHeaders,
  transportIp: string | undefined,
  edgeSecret: string | undefined,
): string | undefined {
  if (edgeSecret !== undefined && edgeSecret.length > 0) {
    const edge = headers['cf-connecting-ip']
    if (headers['x-langx-edge'] === edgeSecret && typeof edge === 'string') {
      const trimmed = edge.trim()
      if (isIPv4(trimmed) || isIPv6(trimmed)) return trimmed
    }
  }
  const resolved = transportIp?.trim()
  return resolved && (isIPv4(resolved) || isIPv6(resolved)) ? resolved : undefined
}

/**
 * Addresses that say nothing about who is on the other end: this machine, and
 * the private ranges a development server or a self-hosted one on a home
 * network sees every device arrive from.
 */
const UNCOUNTED = new BlockList()
UNCOUNTED.addSubnet('127.0.0.0', 8, 'ipv4')
UNCOUNTED.addSubnet('10.0.0.0', 8, 'ipv4')
UNCOUNTED.addSubnet('172.16.0.0', 12, 'ipv4')
UNCOUNTED.addSubnet('192.168.0.0', 16, 'ipv4')
UNCOUNTED.addAddress('::1', 'ipv6')
UNCOUNTED.addSubnet('fc00::', 7, 'ipv6')
UNCOUNTED.addSubnet('fe80::', 10, 'ipv6')

/**
 * The network an address belongs to, as a string to count by — or `undefined`
 * for an address that should not be counted at all.
 *
 * IPv4 as it is. IPv6 by its first 64 bits: a single connection is normally
 * handed a whole /64, and the device picks addresses inside it at will, so
 * the full address would name a moment rather than a network. An IPv4 address
 * written in IPv6 form (`::ffff:203.0.113.7`) is read as the IPv4 it is.
 */
export function networkKey(ip: string): string | undefined {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip)?.[1]
  const address = mapped ?? ip
  if (isIPv4(address)) return UNCOUNTED.check(address, 'ipv4') ? undefined : address
  if (!isIPv6(address) || UNCOUNTED.check(address, 'ipv6')) return undefined
  return `${expandIPv6(address).slice(0, 4).join(':')}::/64`
}

/** The eight groups of an IPv6 address, `::` filled in, lower case, no leading zeros. */
function expandIPv6(address: string): string[] {
  const [head = '', tail] = address.toLowerCase().split('::')
  const left = head ? head.split(':') : []
  const right = tail ? tail.split(':') : []
  const missing = tail === undefined ? 0 : 8 - left.length - right.length
  return [...left, ...Array<string>(missing).fill('0'), ...right].map((group) =>
    group.replace(/^0+(?=.)/, ''),
  )
}
