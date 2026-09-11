import { Platform } from 'react-native'
import { API_URL } from '../lib/apiUrl'
import { versionHeaders } from '../lib/appVersion'
import { authClient } from '../lib/auth-client'

/**
 * How long one request may take before it counts as not having happened.
 *
 * Nothing underneath has a timeout of its own. RN's `XMLHttpRequest.timeout`
 * defaults to 0 and Android's OkHttp client is built with
 * `connectTimeout(0)/readTimeout(0)`, so a connection that is accepted and
 * then answers nothing — a tunnel, a captive portal, a hotel Wi-Fi that wants
 * a login first — leaves the request pending for as long as the app is open.
 * Measured on iOS: still pending after three minutes, with the screen holding
 * its skeletons the whole time, because a query that never settles never
 * reaches the branch that would say so. Fifteen seconds is far past a slow
 * answer on a bad connection and far short of forever.
 */
const REQUEST_TIMEOUT_MS = 10_000

/**
 * What a request we abandoned ourselves rejects with.
 *
 * Worth its own type because the retry policy has to tell it from every other
 * failure: three attempts at fifteen seconds each meant a tunnel took
 * three-quarters of a minute to reach the screen that says so. Measured on a
 * device, with the list pulsing throughout.
 */
export class RequestTimeoutError extends Error {
  constructor(ms: number) {
    super(`Request timed out after ${ms}ms`)
    this.name = 'RequestTimeoutError'
  }
}

export function isRequestTimeout(error: unknown): boolean {
  return error instanceof RequestTimeoutError
}

/**
 * `fetch`, with the timeout the platform does not give it.
 *
 * `AbortSignal.timeout()` would be the one-liner and React Native does not
 * have it — the global behind `AbortSignal` is `abort-controller@3.0.0`, which
 * predates that static. A caller's own signal wins: nothing passes one today,
 * and an upload that does must not have its own cancellation taken away.
 */
async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  if (init.signal) return fetch(url, init)
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (error) {
    // Rethrown as our own, so the retry policy can recognise the one failure
    // that has already cost the caller ten seconds.
    if (timedOut) throw new RequestTimeoutError(REQUEST_TIMEOUT_MS)
    throw error
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Fetch wrapper for *our own* API routes (not Better Auth's, which the
 * client already calls directly). Native has no real cookie jar — the
 * session lives in SecureStore — so the cookie has to be read back out and
 * attached by hand; `credentials: 'omit'` keeps RN's fetch from trying
 * anything cookie-related on its own. Web already has a real cookie jar and
 * the API's CORS config trusts it (`credentials: true`), so the browser
 * handles this without help.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  // Always our own host. Paths carry request-derived pieces (a handle, an id,
  // a cursor), and a path that could also be a whole URL would let one of
  // those pick the host — which is the shape CodeQL flags as request forgery.
  const url = `${API_URL}${path}`

  if (Platform.OS === 'web') {
    /*
     * `/public/` answers with the wildcard origin (`app.ts`, `publicCors`),
     * and a browser refuses a wildcard on a request that carries
     * credentials — before the request is sent, so the server logs nothing.
     * The invite landing page and the onboarding invite-code preview both
     * read `/public/profiles/:handle` and both showed "Nothing here" on the
     * web for exactly this reason. Those routes carry no session by design,
     * so the cookie stays home.
     */
    return fetchWithTimeout(url, {
      ...init,
      credentials: path.startsWith('/public/') ? 'omit' : 'include',
      headers: { ...init.headers, ...versionHeaders() },
    })
  }

  const cookie = await authClient.getCookie()
  return fetchWithTimeout(url, {
    ...init,
    credentials: 'omit',
    headers: { ...init.headers, ...versionHeaders(), cookie },
  })
}
