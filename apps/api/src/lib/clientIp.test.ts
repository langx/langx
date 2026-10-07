import { describe, expect, it } from 'vitest'
import { networkKey, resolveClientIp } from './clientIp'

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
