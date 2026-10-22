import type { FastifyRequest } from 'fastify'
import type { IncomingHttpHeaders } from 'node:http'
import { BlockList, isIPv4, isIPv6 } from 'node:net'
import type { Env } from '../env'

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
 * {@link trustProxyHops}). Unlike the country, Cloudflare's header is not taken
 * at face value when no secret is configured: the origin can be reached
 * without passing through Cloudflare, and a header the edge did not vouch for
 * may have come from the client.
 *
 * Most callers want {@link clientIpOf}, which supplies the arguments from a
 * request.
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
 * {@link resolveClientIp} for a Fastify request — the one answer to "who is
 * asking" that both rate limiters share: Better Auth's, through the bridge in
 * `routes/auth.ts`, and the API's own, through {@link rateLimitKey}. They used
 * to disagree: the API's keyed on `request.ip` alone, so behind Cloudflare it
 * counted Cloudflare's addresses rather than its visitors'.
 */
export function clientIpOf(request: FastifyRequest): string | undefined {
  return resolveClientIp(request.headers, request.ip, request.server.env.EDGE_SECRET)
}

/**
 * The bucket `@fastify/rate-limit` counts a request in: the client's network,
 * as {@link networkKey} groups it, so an IPv6 client is one bucket per /64 as
 * it was under the plugin's default generator. A loopback or private address
 * — a development machine, the test suite — is its own bucket, and a request
 * with no usable address at all falls back to whatever Fastify resolved.
 */
export function rateLimitKey(request: FastifyRequest): string {
  const ip = clientIpOf(request)
  if (ip === undefined) return request.ip
  return networkKey(ip) ?? ip
}

/**
 * Fastify's `trustProxy`: which entries of `X-Forwarded-For` to believe.
 *
 * Never `true`. That believes every entry and makes `request.ip` the left-most
 * one — and Cloudflare and Fly both append to the header a client sent rather
 * than replacing it, so the left-most entry is whatever the client wrote. Each
 * request could name a new address and every rate limit keyed on it was a
 * limit per made-up address, which is to say none.
 *
 * Instead the socket's peer is trusted, and the entries it and the hops behind
 * it appended, and nothing further left. In production that is one hop: the
 * peer is Fly's proxy, and the entry it appended is the address that reached
 * it — Cloudflare's when the request came through the edge (where
 * {@link clientIpOf} reads `CF-Connecting-IP` instead), or the client's own
 * when somebody connects to the origin directly. Neither is one the client can
 * pick. Cloudflare is not counted as a hop, because the origin can be reached
 * without it.
 *
 * A function rather than the number: Fastify 5 reads a bare hop count as
 * "trust nothing", which would make every request appear to come from Fly's
 * proxy and put all of them in one bucket. A function is also what decides
 * `request.protocol` — Fly's `X-Forwarded-Proto` keeps reading `https` because
 * the peer, hop 0, is trusted.
 */
export function trustProxyHops(
  env: Pick<Env, 'NODE_ENV' | 'TRUST_PROXY_HOPS'>,
): false | ((address: string, hop: number) => boolean) {
  const hops = env.TRUST_PROXY_HOPS ?? (env.NODE_ENV === 'production' ? 1 : 0)
  if (hops === 0) return false
  return (_address, hop) => hop < hops
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
