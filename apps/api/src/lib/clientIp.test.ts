import { describe, expect, it } from 'vitest'
import { networkKey, resolveClientIp, trustProxyHops } from './clientIp'

const SECRET = 'edge-secret-value'

describe('resolveClientIp', () => {
  it('believes Cloudflare only when the edge secret matches', () => {
    const vouched = { 'cf-connecting-ip': '203.0.113.7', 'x-langx-edge': SECRET }
    expect(resolveClientIp(vouched, '198.51.100.1', SECRET)).toBe('203.0.113.7')

    const unvouched = { 'cf-connecting-ip': '203.0.113.7', 'x-langx-edge': 'wrong' }
    expect(resolveClientIp(unvouched, '198.51.100.1', SECRET)).toBe('198.51.100.1')
  })

  it('ignores the Cloudflare header when no edge is configured', () => {
    expect(resolveClientIp({ 'cf-connecting-ip': '203.0.113.7' }, '198.51.100.1', undefined)).toBe(
      '198.51.100.1',
    )
  })

  it('has no answer without a valid address', () => {
    expect(resolveClientIp({}, undefined, undefined)).toBeUndefined()
    expect(resolveClientIp({}, 'not-an-ip', undefined)).toBeUndefined()
    expect(
      resolveClientIp({ 'cf-connecting-ip': 'nope', 'x-langx-edge': SECRET }, undefined, SECRET),
    ).toBeUndefined()
  })
})

describe('networkKey', () => {
  it('keeps a public IPv4 address as it is', () => {
    expect(networkKey('203.0.113.7')).toBe('203.0.113.7')
    expect(networkKey('::ffff:203.0.113.7')).toBe('203.0.113.7')
  })

  it('groups IPv6 by its /64', () => {
    expect(networkKey('2001:db8:1:2:aaaa::1')).toBe('2001:db8:1:2::/64')
    expect(networkKey('2001:0db8:0001:0002:ffff:ffff:ffff:ffff')).toBe('2001:db8:1:2::/64')
    expect(networkKey('2001:db8::5')).toBe('2001:db8:0:0::/64')
  })

  it('does not count loopback or private addresses', () => {
    for (const ip of [
      '127.0.0.1',
      '::1',
      '::ffff:127.0.0.1',
      '10.1.2.3',
      '192.168.1.20',
      'fd00::1',
    ]) {
      expect(networkKey(ip)).toBeUndefined()
    }
  })
})

describe('trustProxyHops', () => {
  it('trusts exactly the peer in production, so the last forwarded entry is the address', () => {
    const trust = trustProxyHops({ NODE_ENV: 'production', TRUST_PROXY_HOPS: undefined })
    if (trust === false) throw new Error('expected a trust function')
    expect(trust('172.16.0.2', 0)).toBe(true)
    expect(trust('198.51.100.7', 1)).toBe(false)
  })

  it('trusts no proxy outside production unless told to', () => {
    expect(trustProxyHops({ NODE_ENV: 'development', TRUST_PROXY_HOPS: undefined })).toBe(false)
    expect(trustProxyHops({ NODE_ENV: 'production', TRUST_PROXY_HOPS: 0 })).toBe(false)

    const two = trustProxyHops({ NODE_ENV: 'development', TRUST_PROXY_HOPS: 2 })
    if (two === false) throw new Error('expected a trust function')
    expect([two('a', 0), two('b', 1), two('c', 2)]).toEqual([true, true, false])
  })
})
