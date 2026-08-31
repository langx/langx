import { APP_SCHEME } from '@langx/shared'
import { expoClient } from '@better-auth/expo/client'
import { createAuthClient } from 'better-auth/react'
import { anonymousClient, deviceAuthorizationClient } from 'better-auth/client/plugins'
import * as SecureStore from 'expo-secure-store'
import { API_URL } from './apiUrl'
import { currentLocale } from '../i18n/runtime'

/**
 * One client for iOS, Android and web. `expoClient` branches on
 * `Platform.OS === 'web'` internally: native persists the session cookie in
 * SecureStore (there's no real cookie jar), web relies on the browser's own
 * cookies. Passing `storage` here is a no-op on web, not a mistake.
 */
export const authClient = createAuthClient({
  baseURL: API_URL,
  /**
   * Sign-up and the password-reset request both send an email, and both happen
   * before there is an account to hold a language preference — so the header
   * is the only thing that can tell the server which language to write in.
   */
  fetchOptions: {
    headers: {
      get 'accept-language'() {
        return currentLocale()
      },
    },
  },
  plugins: [
    /*
     * QR sign-in, from both ends: the web build calls `device.code` and polls
     * `device.token`, and a signed-in phone calls `device.approve`. One client
     * covers both because it is one codebase.
     */
    deviceAuthorizationClient(),
    /*
     * `signIn.anonymous()`, for somebody who wants to look before signing up.
     * Only the sign-in half is used — the guest is signed out and registers
     * fresh rather than being linked, because a guest cannot write and so has
     * nothing to carry across. See `auth.ts` on the server.
     */
    anonymousClient(),
    expoClient({
      scheme: APP_SCHEME,
      storage: SecureStore,
    }),
  ],
})

export type Session = typeof authClient.$Infer.Session
