import { Platform } from 'react-native'
import { authClient } from '../lib/auth-client'

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000'

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
    return fetch(url, { ...init, credentials: 'include' })
  }

  const cookie = await authClient.getCookie()
  return fetch(url, {
    ...init,
    credentials: 'omit',
    headers: { ...init.headers, cookie },
  })
}
