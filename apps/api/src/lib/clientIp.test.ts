import { describe, expect, it } from 'vitest'
import { CLIENT_IP_HEADER, clientIpFromHeaders, networkKey } from './clientIp'

const SECRET = 'edge-secret-value'

describe('clientIpFromHeaders', () => {
  it('believes Cloudflare only when the edge secret matches', () => {
    const headers = new Headers({
      'cf-connecting-ip': '203.0.113.7',
      'x-langx-edge': SECRET,
      [CLIENT_IP_HEADER]: '198.51.100.1',
    })
    expect(clientIpFromHeaders(headers, SECRET)).toBe('203.0.113.7')

    headers.set('x-langx-edge', 'wrong')
    expect(clientIpFromHeaders(headers, SECRET)).toBe('198.51.100.1')
  })

  it('ignores the Cloudflare header when no edge is configured', () => {
    const headers = new Headers({
      'cf-connecting-ip': '203.0.113.7',
      [CLIENT_IP_HEADER]: '198.51.100.1',
    })
    expect(clientIpFromHeaders(headers, undefined)).toBe('198.51.100.1')
  })

  it('has no answer without headers or a valid address', () => {
    expect(clientIpFromHeaders(undefined, undefined)).toBeUndefined()
    expect(clientIpFromHeaders(new Headers(), undefined)).toBeUndefined()
    expect(
      clientIpFromHeaders(new Headers({ [CLIENT_IP_HEADER]: 'not-an-ip' }), undefined),
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
