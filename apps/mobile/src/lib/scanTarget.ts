import { APP_SCHEMES, HANDLE_PATTERN, inviteHandleFromUrl, WEB_HOST } from '@langx/shared'

/**
 * What a scanned code turned out to be. Only the two kinds the app itself
 * draws are recognised: the sign-in QR (`deviceLinkTarget`) and a profile or
 * invite QR. Anything else is `null`, and the scanner keeps looking.
 */
export type ScanTarget = { kind: 'device'; code: string } | { kind: 'profile'; handle: string }

const WEB_ORIGINS = [`https://${WEB_HOST}/`, `http://${WEB_HOST}/`]

/**
 * Reads a scanned string without `new URL`: React Native's `URL` is partial,
 * and `inviteHandleFromUrl` already made the same choice for the same reason.
 * Total — a scanner hands over whatever it saw, and a throw here would be a
 * crash on somebody else's sticker.
 */
export function scanTarget(raw: string): ScanTarget | null {
  const text = raw.trim()
  if (!text) return null

  for (const scheme of APP_SCHEMES) {
    for (const prefix of [`${scheme}://link-device?`, `${scheme}:///link-device?`]) {
      if (text.toLowerCase().startsWith(prefix)) {
        const code = param(text.slice(prefix.length), 'user_code')
        return code ? { kind: 'device', code: code.toUpperCase() } : null
      }
    }
  }

  // `inviteHandleFromUrl` reads the path off any host — right for a link the
  // app itself was opened with, wrong for a sticker: only our own web host
  // and our own schemes count here.
  const ours =
    WEB_ORIGINS.some((origin) => text.toLowerCase().startsWith(origin)) ||
    APP_SCHEMES.some((scheme) => text.toLowerCase().startsWith(`${scheme}:`))
  const invited = ours ? inviteHandleFromUrl(text) : null
  if (invited) return { kind: 'profile', handle: invited }

  for (const origin of WEB_ORIGINS) {
    if (text.toLowerCase().startsWith(origin)) {
      const rest = text.slice(origin.length)
      const handle = rest.split(/[?#/]/)[0]?.toLowerCase() ?? ''
      if (HANDLE_PATTERN.test(handle)) return { kind: 'profile', handle }
      return null
    }
  }

  return null
}

function param(query: string, name: string): string | null {
  for (const pair of query.split('&')) {
    const [key, value = ''] = pair.split('=')
    if (key === name) {
      try {
        return decodeURIComponent(value)
      } catch {
        return null
      }
    }
  }
  return null
}
