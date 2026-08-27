import { APP_SCHEME } from '@langx/shared'
import { expoClient } from '@better-auth/expo/client'
import { createAuthClient } from 'better-auth/react'
import * as SecureStore from 'expo-secure-store'
import { API_URL } from './apiUrl'

/**
 * One client for iOS, Android and web. `expoClient` branches on
 * `Platform.OS === 'web'` internally: native persists the session cookie in
 * SecureStore (there's no real cookie jar), web relies on the browser's own
 * cookies. Passing `storage` here is a no-op on web, not a mistake.
 */
export const authClient = createAuthClient({
  baseURL: API_URL,
  plugins: [
    expoClient({
      scheme: APP_SCHEME,
      storage: SecureStore,
    }),
  ],
})

export type Session = typeof authClient.$Infer.Session
