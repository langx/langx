/**
 * What to call the thing somebody just signed in from.
 *
 * Two answers, and they are used for different things. The **fingerprint** is
 * what decides whether this device is new — coarse on purpose, because a
 * browser version bump is not a new device and a mail that says so is a mail
 * people learn to ignore. The **label** is what a person reads: "Safari on
 * iPhone", the shape every other service words it in.
 *
 * Not a user-agent library. Those carry a regex database the size of this
 * app's whole i18n catalogue, and they exist to tell Chrome 118 from Chrome
 * 119 — precisely the distinction being thrown away here.
 */

export interface DeviceIdentity {
  /** Stable across versions: `ios-safari`, `android-chrome`, `macos-app`. */
  fingerprint: string
  /** For the mail: "Safari on iPhone". */
  label: string
}

const UNKNOWN: DeviceIdentity = { fingerprint: 'unknown', label: 'an unrecognised device' }

/** Ours first: the app's own requests should not read as "Safari on iPhone". */
function appIdentity(userAgent: string): DeviceIdentity | null {
  if (/\bExpo\b|LangX/i.test(userAgent)) {
    if (/\bAndroid\b/i.test(userAgent))
      return { fingerprint: 'android-app', label: 'the LangX app on Android' }
    if (/\biPhone|iPad|iOS|CFNetwork\b/i.test(userAgent)) {
      return { fingerprint: 'ios-app', label: 'the LangX app on iPhone' }
    }
    return { fingerprint: 'app', label: 'the LangX app' }
  }
  return null
}

function platformOf(userAgent: string): { key: string; name: string } {
  if (/\biPad\b/i.test(userAgent)) return { key: 'ipados', name: 'iPad' }
  if (/\biPhone\b/i.test(userAgent)) return { key: 'ios', name: 'iPhone' }
  if (/\bAndroid\b/i.test(userAgent)) return { key: 'android', name: 'Android' }
  if (/\bWindows\b/i.test(userAgent)) return { key: 'windows', name: 'Windows' }
  // Mac has to come after iOS: an iPhone's UA says "like Mac OS X".
  if (/\bMac OS X|Macintosh\b/i.test(userAgent)) return { key: 'macos', name: 'Mac' }
  if (/\bCrOS\b/i.test(userAgent)) return { key: 'chromeos', name: 'ChromeOS' }
  if (/\bLinux\b/i.test(userAgent)) return { key: 'linux', name: 'Linux' }
  return { key: 'other', name: 'an unrecognised device' }
}

/**
 * Order matters more than the patterns do. Every one of these browsers claims
 * to be several of the others — Edge says "Chrome", Chrome says "Safari" —
 * so the most specific name has to be tested first.
 */
function browserOf(userAgent: string): { key: string; name: string } | null {
  if (/\bEdgA?\b|\bEdge\//i.test(userAgent)) return { key: 'edge', name: 'Edge' }
  if (/\bOPR\b|\bOpera\b/i.test(userAgent)) return { key: 'opera', name: 'Opera' }
  if (/\bFxiOS\b|\bFirefox\b/i.test(userAgent)) return { key: 'firefox', name: 'Firefox' }
  if (/\bSamsungBrowser\b/i.test(userAgent)) return { key: 'samsung', name: 'Samsung Internet' }
  if (/\bCriOS\b|\bChrome\b/i.test(userAgent)) return { key: 'chrome', name: 'Chrome' }
  if (/\bSafari\b/i.test(userAgent)) return { key: 'safari', name: 'Safari' }
  return null
}

export function deviceIdentity(userAgent: string | undefined | null): DeviceIdentity {
  const agent = (userAgent ?? '').trim()
  if (agent.length === 0) return UNKNOWN

  const app = appIdentity(agent)
  if (app) return app

  const platform = platformOf(agent)
  const browser = browserOf(agent)
  if (!browser) {
    // curl, a bot, a script: named by what it said it was, up to a point.
    const name = agent.split(/[\s/]/)[0] ?? 'unknown'
    return { fingerprint: `other-${name.toLowerCase().slice(0, 24)}`, label: name.slice(0, 24) }
  }
  return {
    fingerprint: `${platform.key}-${browser.key}`,
    label: `${browser.name} on ${platform.name}`,
  }
}

/**
 * The country Cloudflare says the request came from, as a two-letter code.
 *
 * `cf-ipcountry` is set at the edge and cannot be forged by the client — the
 * origin only accepts proxied requests (see `EDGE_SECRET`). `XX` is
 * Cloudflare's own "unknown", and `T1` is Tor; both are treated as no answer.
 */
export function countryFromHeaders(headers: Headers | undefined): string | undefined {
  const value = headers?.get('cf-ipcountry')?.trim().toUpperCase()
  if (!value || value === 'XX' || value === 'T1') return undefined
  return /^[A-Z]{2}$/.test(value) ? value : undefined
}
