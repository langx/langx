import { describe, expect, it } from 'vitest'
import { countryFromHeaders, deviceIdentity } from './deviceLabel'

/** Real strings, taken off `session.userAgent` in production. */
const AGENTS = {
  iphoneFirefox:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/154.0 Mobile/15E148 Safari/604.1',
  windowsChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
  macSafari:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  androidChrome:
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Mobile Safari/537.36',
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36 Edg/152.0.0.0',
  expoIos: 'LangX/2.2 CFNetwork/1568.100.1 Darwin/24.0.0',
  curl: 'curl/8.5.0',
}

describe('naming the device somebody signed in from', () => {
  it('reads the four shapes people actually arrive in', () => {
    expect(deviceIdentity(AGENTS.iphoneSafari)).toEqual({
      fingerprint: 'ios-safari',
      label: 'Safari on iPhone',
    })
    expect(deviceIdentity(AGENTS.androidChrome)).toEqual({
      fingerprint: 'android-chrome',
      label: 'Chrome on Android',
    })
    expect(deviceIdentity(AGENTS.macSafari)).toEqual({
      fingerprint: 'macos-safari',
      label: 'Safari on Mac',
    })
    expect(deviceIdentity(AGENTS.expoIos)).toEqual({
      fingerprint: 'ios-app',
      label: 'the LangX app on iPhone',
    })
  })

  /**
   * Every browser claims to be several of the others, which is why the order
   * of the tests inside `browserOf` is the whole implementation.
   */
  it('is not fooled by a browser claiming to be another one', () => {
    expect(deviceIdentity(AGENTS.edge).label).toBe('Edge on Windows')
    expect(deviceIdentity(AGENTS.windowsChrome).label).toBe('Chrome on Windows')
    expect(deviceIdentity(AGENTS.iphoneFirefox).label).toBe('Firefox on iPhone')
    // An iPhone's user agent says "like Mac OS X", and it is not a Mac.
    expect(deviceIdentity(AGENTS.iphoneFirefox).fingerprint).toBe('ios-firefox')
  })

  /** A version bump is not a new device; a mail that says so is one people mute. */
  it('gives one fingerprint across versions of the same browser', () => {
    const now = deviceIdentity(AGENTS.windowsChrome).fingerprint
    const later = deviceIdentity(AGENTS.windowsChrome.replace('152.0.0.0', '191.0.3.7')).fingerprint
    expect(later).toBe(now)
  })

  it('names a script by what it called itself, and an absent agent not at all', () => {
    expect(deviceIdentity(AGENTS.curl)).toEqual({ fingerprint: 'other-curl', label: 'curl' })
    expect(deviceIdentity('').fingerprint).toBe('unknown')
    expect(deviceIdentity(undefined).fingerprint).toBe('unknown')
  })

  it('takes the country from the edge, and only a real one', () => {
    const of = (value?: string) =>
      countryFromHeaders(value ? new Headers({ 'cf-ipcountry': value }) : new Headers())
    expect(of('tr')).toBe('TR')
    expect(of('CA')).toBe('CA')
    // Cloudflare's own "we do not know", and its code for Tor.
    expect(of('XX')).toBeUndefined()
    expect(of('T1')).toBeUndefined()
    expect(of('nonsense')).toBeUndefined()
    expect(of()).toBeUndefined()
    expect(countryFromHeaders(undefined)).toBeUndefined()
  })
})
