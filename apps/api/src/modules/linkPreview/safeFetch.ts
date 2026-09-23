import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from 'node:dns'
import http from 'node:http'
import https from 'node:https'
import { BlockList, isIP } from 'node:net'
import type { Readable } from 'node:stream'
import zlib from 'node:zlib'

/**
 * Fetching an address somebody typed into a chat, from inside our network.
 *
 * This is the one place the API reaches out to a host a user chose, and the
 * whole danger of that is request forgery: an address that resolves to
 * 127.0.0.1, to Fly's private `fdaa::` network, or to a cloud metadata
 * endpoint would have this process read something only it can reach and hand
 * the result to whoever asked. So every hop — the first request and each
 * redirect — goes through three checks:
 *
 * 1. the address itself: http or https, default port, no credentials, and a
 *    literal IP must be a public one;
 * 2. the *resolved* address, checked inside the socket's own `lookup`, so the
 *    IP that was checked is the IP that is connected to. Resolving first and
 *    fetching second would leave a window for DNS rebinding;
 * 3. size and time: the body is cut off at a cap (after decompression, so a
 *    gzip bomb stops at the same place) and the whole chain has one deadline.
 *
 * `node:http` rather than `fetch` because `fetch` offers no hook between
 * resolving and connecting without importing undici's `Agent`, which is not a
 * dependency here.
 */

const BLOCKED = new BlockList()
for (const [net, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.88.99.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  BLOCKED.addSubnet(net, prefix, 'ipv4')
}
for (const [net, prefix] of [
  ['::', 128],
  ['::1', 128],
  // NAT64 and the two tunnelling ranges can each carry an IPv4 address
  // inside them, private ones included.
  ['64:ff9b::', 96],
  ['2001::', 32],
  ['2002::', 16],
  ['100::', 64],
  ['2001:db8::', 32],
  // Unique-local, which is where Fly's private network lives, then
  // link-local and multicast.
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  BLOCKED.addSubnet(net, prefix, 'ipv6')
}

/**
 * Whether an IP is somewhere on the public internet.
 *
 * `BlockList` also answers for IPv4-mapped IPv6 (`::ffff:127.0.0.1`) against
 * the IPv4 rules, which is the spelling a resolver can hand back on a
 * dual-stack host — there is a test for it.
 */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 0) return false
  return !BLOCKED.check(address, family === 6 ? 'ipv6' : 'ipv4')
}

/** Names that never mean the public internet, refused before any lookup. */
const PRIVATE_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home.arpa']

export function isFetchableUrl(url: URL): boolean {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
  // URL normalises the scheme's own port to '', so anything else is a choice.
  if (url.port !== '') return false
  if (url.username || url.password) return false
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (!host || host === 'localhost') return false
  if (PRIVATE_SUFFIXES.some((suffix) => host.endsWith(suffix))) return false
  if (isIP(host)) return isPublicAddress(host)
  return host.includes('.')
}

/** Refused inside the socket, so it reads as a connection error and ends the chain. */
class BlockedAddressError extends Error {
  constructor(hostname: string) {
    super(`${hostname} resolves to a non-public address`)
    this.name = 'BlockedAddressError'
  }
}

type LookupCallback = (
  err: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void

/**
 * `dns.lookup` with every answer checked. If any address a name resolves to
 * is private the whole name is refused — picking the public one would let a
 * record that lists both steer the socket on a retry.
 */
export function guardedLookup(
  hostname: string,
  options: LookupOptions,
  callback: LookupCallback,
): void {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) {
      callback(err, '')
      return
    }
    if (addresses.length === 0 || addresses.some((a) => !isPublicAddress(a.address))) {
      callback(new BlockedAddressError(hostname), '')
      return
    }
    if (options.all) {
      callback(null, addresses)
      return
    }
    const first = addresses[0] as LookupAddress
    callback(null, first.address, first.family)
  })
}

export interface SafeGetOptions {
  /** Content types accepted, by prefix — `text/html`, `image/`. */
  accept: readonly string[]
  maxBytes: number
  /**
   * Keep what arrived when the cap is reached, rather than failing. Right for
   * a page, whose `<head>` is at the top; wrong for a picture, where half a
   * JPEG is not a smaller JPEG.
   */
  truncate: boolean
  timeoutMs?: number
}

export interface SafeResponse {
  /** Where the chain ended, after redirects — relative links resolve against it. */
  url: URL
  contentType: string
  body: Buffer
}

export type SafeGet = (address: string, options: SafeGetOptions) => Promise<SafeResponse | null>

const MAX_REDIRECTS = 4
const DEFAULT_TIMEOUT_MS = 6000
const USER_AGENT = 'Mozilla/5.0 (compatible; LangXBot/1.0; +https://langx.io)'

/**
 * GET an address a person typed, or `null` for any reason at all.
 *
 * Every failure is the same `null` on purpose: the caller draws no card
 * either way, and a reason would only be something to leak.
 */
export const safeGet: SafeGet = async (address, options) => {
  let url: URL
  try {
    url = new URL(address)
  } catch {
    return null
  }
  const deadline = Date.now() + (options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isFetchableUrl(url)) return null
    const outcome = await requestOnce(url, options, deadline).catch(() => null)
    if (!outcome) return null
    if ('response' in outcome) return outcome.response
    try {
      url = new URL(outcome.redirect, url)
    } catch {
      return null
    }
  }
  return null
}

type Outcome = { response: SafeResponse } | { redirect: string }

function requestOnce(url: URL, options: SafeGetOptions, deadline: number): Promise<Outcome | null> {
  const remaining = deadline - Date.now()
  if (remaining <= 0) return Promise.resolve(null)
  const client = url.protocol === 'https:' ? https : http
  return new Promise((resolve) => {
    /*
     * One timer for the whole exchange, body included, and cleared only when
     * the answer is settled: a server that sends its headers at once and then
     * drips the body a byte a minute is exactly the one this is for.
     */
    const finish = (outcome: Outcome | null) => {
      clearTimeout(timer)
      resolve(outcome)
    }
    const request = client.get(
      url,
      {
        // No pooled sockets: a kept-alive connection would skip the lookup.
        agent: false,
        lookup: guardedLookup,
        headers: {
          'user-agent': USER_AGENT,
          accept: options.accept.map((type) => (type.endsWith('/') ? `${type}*` : type)).join(', '),
          'accept-encoding': 'gzip, deflate, br',
        },
      },
      (response) => {
        const status = response.statusCode ?? 0
        const location = response.headers.location
        if (status >= 300 && status < 400 && location) {
          response.destroy()
          finish({ redirect: location })
          return
        }
        const contentType = (response.headers['content-type'] ?? '').toLowerCase()
        if (
          status < 200 ||
          status >= 300 ||
          !options.accept.some((t) => contentType.startsWith(t))
        ) {
          response.destroy()
          finish(null)
          return
        }
        readCapped(response, options)
          .then((body) => {
            finish(body ? { response: { url, contentType, body } } : null)
          })
          .catch(() => {
            finish(null)
          })
      },
    )
    const timer = setTimeout(() => request.destroy(new Error('timeout')), remaining)
    request.on('error', () => {
      finish(null)
    })
  })
}

/**
 * The body as it was meant to be read. A decompressor is its own stream, so
 * the response's errors are passed along by hand — otherwise a connection cut
 * mid-body would leave the reader below waiting on a stream that never ends.
 */
function decoded(response: http.IncomingMessage): Readable {
  const encoding = response.headers['content-encoding']
  const decoder =
    encoding === 'gzip' || encoding === 'x-gzip'
      ? zlib.createGunzip()
      : encoding === 'deflate'
        ? zlib.createInflate()
        : encoding === 'br'
          ? zlib.createBrotliDecompress()
          : null
  if (!decoder) return response
  response.on('error', (err) => decoder.destroy(err))
  return response.pipe(decoder)
}

async function readCapped(
  response: http.IncomingMessage,
  options: SafeGetOptions,
): Promise<Buffer | null> {
  const stream = decoded(response)
  const chunks: Buffer[] = []
  let size = 0
  try {
    for await (const chunk of stream as AsyncIterable<Buffer>) {
      const room = options.maxBytes - size
      if (chunk.length > room) {
        if (!options.truncate) return null
        chunks.push(chunk.subarray(0, room))
        break
      }
      chunks.push(chunk)
      size += chunk.length
    }
  } finally {
    // Stop downloading the rest, whichever way the loop ended.
    stream.destroy()
    response.destroy()
  }
  return Buffer.concat(chunks)
}
