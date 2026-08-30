import { describe, expect, it } from 'vitest'
import { countryFromHeaders } from './requestCountry'

const SECRET = 'edge-secret'

describe('countryFromHeaders', () => {
  it('reads the country Cloudflare put on a request that carries the secret', () => {
    expect(countryFromHeaders({ 'cf-ipcountry': 'TR', 'x-langx-edge': SECRET }, SECRET)).toBe('TR')
    expect(countryFromHeaders({ 'cf-ipcountry': 'de', 'x-langx-edge': SECRET }, SECRET)).toBe('DE')
  })

  /**
   * The whole point of the secret: the Fly origin is reachable by IP, so
   * without this anyone could pick their own country by sending a header.
   */
  it('ignores the header on a request that did not come through the edge', () => {
    expect(countryFromHeaders({ 'cf-ipcountry': 'DE' }, SECRET)).toBeUndefined()
    expect(
      countryFromHeaders({ 'cf-ipcountry': 'DE', 'x-langx-edge': 'wrong' }, SECRET),
    ).toBeUndefined()
  })

  it('takes the header at face value where no edge is configured at all', () => {
    expect(countryFromHeaders({ 'cf-ipcountry': 'TR' }, undefined)).toBe('TR')
    expect(countryFromHeaders({ 'cf-ipcountry': 'TR' }, '')).toBe('TR')
  })

  it('treats Cloudflare’s "cannot say" answers as no answer', () => {
    expect(countryFromHeaders({ 'cf-ipcountry': 'XX' }, undefined)).toBeUndefined()
    expect(countryFromHeaders({ 'cf-ipcountry': 'T1' }, undefined)).toBeUndefined()
    expect(countryFromHeaders({ 'cf-ipcountry': 'ZZ' }, undefined)).toBeUndefined()
    expect(countryFromHeaders({}, undefined)).toBeUndefined()
  })
})
