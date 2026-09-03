/**
 * A user agent turned into something a person can recognise their own device in.
 *
 * Not a parser. The question this answers is "is one of these rows the laptop
 * I am worried about", and for that a phone needs to say phone and a browser
 * needs to say which browser — everything past that is noise on a row that is
 * two lines tall.
 *
 * Order matters: the app's own networking layers name themselves before they
 * name a browser engine, and Chrome's agent claims Safari, so the specific
 * cases have to be tested before the general ones.
 */
export function sessionLabel(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null
  const ua = userAgent.toLowerCase()

  // The app itself: iOS networking is CFNetwork/Darwin, Android's OkHttp.
  if (ua.includes('cfnetwork') || ua.includes('darwin')) return 'LangX · iPhone'
  if (ua.includes('okhttp')) return 'LangX · Android'

  const browser = ua.includes('firefox')
    ? 'Firefox'
    : ua.includes('edg/')
      ? 'Edge'
      : ua.includes('chrome') || ua.includes('crios')
        ? 'Chrome'
        : ua.includes('safari')
          ? 'Safari'
          : null
  if (!browser) return null

  const platform =
    ua.includes('iphone') || ua.includes('ipad')
      ? 'iOS'
      : ua.includes('android')
        ? 'Android'
        : ua.includes('mac os')
          ? 'Mac'
          : ua.includes('windows')
            ? 'Windows'
            : ua.includes('linux')
              ? 'Linux'
              : null

  return platform ? `${browser} · ${platform}` : browser
}
