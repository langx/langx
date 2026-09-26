import { APP_SCHEMES, inviteHandleFromUrl } from '@langx/shared'
import { internalTarget, WEB_ORIGINS } from './internalLink'

/**
 * What a scanned code turned out to be. Only the two kinds the app itself
 * draws are recognised: the sign-in QR (`deviceLinkTarget`) and a profile or
 * invite QR. Anything else is `null`, and the scanner keeps looking.
 */
export type ScanTarget = { kind: 'device'; code: string } | { kind: 'profile'; handle: string }

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

  // The same reading a link in a chat gets, so `/discover` on a sticker is a
  // screen rather than a person called that. A post link is not a code the
  // app draws, so it stays unrecognised like any other.
  const target = internalTarget(text)
  return target?.kind === 'profile' ? target : null
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
