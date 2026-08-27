import { describe, expect, it } from 'vitest'
import { resolveApiUrl } from './resolveApiUrl'

const LAN = '192.168.1.24:8081'

describe('resolveApiUrl', () => {
  it('points a development build on a phone at the machine running Metro', () => {
    // The whole point: on a real device `localhost` is the device, so the
    // default configuration cannot reach the API at all.
    expect(resolveApiUrl('http://localhost:4000', LAN, true, false)).toBe(
      'http://192.168.1.24:4000',
    )
  })

  it("keeps the API port rather than Metro's", () => {
    expect(resolveApiUrl('http://localhost:9999', LAN, true, false)).toBe(
      'http://192.168.1.24:9999',
    )
  })

  it('never rewrites a real API URL', () => {
    // A production build must not be redirected by whatever a bundler reports.
    expect(resolveApiUrl('https://api.langx.io', LAN, true, false)).toBe('https://api.langx.io')
    expect(resolveApiUrl('http://localhost:4000', LAN, false, false)).toBe('http://localhost:4000')
  })

  it('leaves web alone, where loopback is the right answer', () => {
    expect(resolveApiUrl('http://localhost:4000', LAN, true, true)).toBe('http://localhost:4000')
  })

  it('changes nothing when Metro is itself on loopback', () => {
    // An emulator or a tunnel: there is no better address to offer, and
    // rewriting loopback to loopback would only look like it did something.
    expect(resolveApiUrl('http://localhost:4000', 'localhost:8081', true, false)).toBe(
      'http://localhost:4000',
    )
    expect(resolveApiUrl('http://localhost:4000', undefined, true, false)).toBe(
      'http://localhost:4000',
    )
  })

  it('falls back rather than throwing on an unusable value', () => {
    expect(resolveApiUrl(undefined, undefined, false, false)).toBe('http://localhost:4000')
    expect(resolveApiUrl('not a url', LAN, true, false)).toBe('not a url')
  })
})
