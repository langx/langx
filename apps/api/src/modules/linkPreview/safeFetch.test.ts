import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { guardedLookup, isFetchableUrl, isPublicAddress, safeGet } from './safeFetch'

describe('isPublicAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    '::',
    'fdaa:0:1::3',
    'fe80::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
  ])('refuses %s', (address) => {
    expect(isPublicAddress(address)).toBe(false)
  })

  it.each(['1.1.1.1', '142.250.72.14', '2606:4700:4700::1111'])('allows %s', (address) => {
    expect(isPublicAddress(address)).toBe(true)
  })

  it('refuses something that is not an IP at all', () => {
    expect(isPublicAddress('langx.io')).toBe(false)
  })
})

describe('isFetchableUrl', () => {
  it.each(['https://langx.io/pro', 'http://example.com/a?b=c', 'https://8.8.8.8/'])(
    'allows %s',
    (address) => {
      expect(isFetchableUrl(new URL(address))).toBe(true)
    },
  )

  it.each([
    'ftp://example.com/',
    'file:///etc/passwd',
    'https://example.com:8443/',
    'http://example.com:22/',
    'https://user:pass@example.com/',
    'http://localhost/',
    'http://api.localhost/',
    'http://printer.local/',
    'http://metadata.google.internal/',
    'http://127.0.0.1/',
    'http://169.254.169.254/latest/meta-data/',
    'http://[::1]/',
    'http://[fdaa::3]/',
    'http://intranet/',
  ])('refuses %s', (address) => {
    expect(isFetchableUrl(new URL(address))).toBe(false)
  })
})

describe('safeGet', () => {
  let server: Server
  let port: number

  beforeAll(async () => {
    server = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end('<title>secret</title>')
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    port = (server.address() as AddressInfo).port
  })

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve))
  })

  const options = { accept: ['text/html'], maxBytes: 1024, truncate: true }

  it('never reaches a server on this machine', async () => {
    expect(await safeGet(`http://127.0.0.1:${port}/`, options)).toBeNull()
    expect(await safeGet(`http://localhost:${port}/`, options)).toBeNull()
  })

  it('refuses anything that is not an address', async () => {
    expect(await safeGet('not a url', options)).toBeNull()
  })
})

describe('guardedLookup', () => {
  /*
   * The check that matters most, and the one a name check cannot make: a
   * public-looking name whose record points inside. `localhost.` — with the
   * trailing dot — passes `isFetchableUrl`, so it stands in for a rebinding
   * domain here.
   */
  it('refuses a name that resolves to loopback', async () => {
    expect(isFetchableUrl(new URL('http://localhost./'))).toBe(true)
    const err = await new Promise<Error | null>((resolve) => {
      guardedLookup('localhost.', {}, (error) => {
        resolve(error)
      })
    })
    expect(err?.name).toBe('BlockedAddressError')
  })
})
