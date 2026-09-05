import { Platform } from 'react-native'
import { API_URL } from '../lib/apiUrl'
import { versionHeaders } from '../lib/appVersion'
import { authClient } from '../lib/auth-client'

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
  const url = path.startsWith('http') ? path : `${API_URL}${path}`

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
    return fetch(url, {
      ...init,
      credentials: path.startsWith('/public/') ? 'omit' : 'include',
      headers: { ...init.headers, ...versionHeaders() },
    })
  }

  const cookie = await authClient.getCookie()
  return fetch(url, {
    ...init,
    credentials: 'omit',
    headers: { ...init.headers, ...versionHeaders(), cookie },
  })
}
