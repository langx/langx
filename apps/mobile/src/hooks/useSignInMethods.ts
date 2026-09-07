import type { LinkedProvider, SetPasswordInput, SignInMethods } from '@langx/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as Linking from 'expo-linking'
import { api } from '../api/client'
import { isNativeAppleSignInAvailable, requestAppleIdentity } from '../lib/appleSignIn'
import { authClient } from '../lib/auth-client'

export const SIGN_IN_METHODS_KEY = ['sign-in-methods'] as const

/**
 * Every way this person can get back into their account.
 *
 * Not cached across sessions and not prefetched: it is read on one screen, and
 * a stale answer here is worse than a spinner — telling somebody they have a
 * password when they no longer do is the kind of wrong that only shows up when
 * they are already locked out.
 */
export function useSignInMethods() {
  return useQuery<SignInMethods>({
    queryKey: SIGN_IN_METHODS_KEY,
    queryFn: () => api.get<SignInMethods>('/me/sign-in-methods'),
  })
}

/**
 * Adds a first password to an account that was made with Google or Apple.
 *
 * Invalidates rather than writing the new state in by hand: the server decides
 * what counts as having a password, and this screen exists precisely because
 * guessing at that from the client is how somebody ends up locked out.
 */
export function useSetPassword() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (password: string) =>
      api.post<void>('/me/password', { password } satisfies SetPasswordInput),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SIGN_IN_METHODS_KEY }),
  })
}

/** Better Auth's own code for a current password that does not match. */
export const WRONG_CURRENT_PASSWORD = 'INVALID_PASSWORD'

/**
 * Replaces a password that already exists, which is Better Auth's own
 * `/change-password` and so goes through `authClient` like the session
 * endpoints do, not through a route of ours. It asks for the current one:
 * `/me/password` deliberately refuses to overwrite, so that a live session
 * can only ever *add* a way in and never take one over.
 *
 * Other sessions stay signed in. Somebody changing a password from their own
 * phone is not usually locking anybody out, and the devices screen exists for
 * when they are. The rejection carries Better Auth's code so the screen can
 * tell "wrong current password" apart from "try again".
 */
export function useChangePassword() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { currentPassword: string; newPassword: string }) => {
      const { error } = await authClient.changePassword({
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
        revokeOtherSessions: false,
      })
      if (error) throw new Error(error.code ?? error.message ?? 'could not change the password')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SIGN_IN_METHODS_KEY }),
  })
}

/** Where a browser-based link returns to: this screen, either way. */
function linkRedirects() {
  const here = Linking.createURL('/settings/sign-in-methods')
  return { callbackURL: here, errorCallbackURL: here }
}

/**
 * Connects Google or Apple to the signed-in account.
 *
 * The same two roads sign-in takes: Apple on a device goes through the native
 * sheet and hands Better Auth the identity token, so nothing leaves the app;
 * everything else opens the provider in a browser and comes back to this
 * screen, where the list is refetched on focus. Resolves `'cancelled'` when
 * the person closed the Apple sheet — that is not a failure to report.
 */
export function useLinkProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      provider: LinkedProvider,
    ): Promise<'linked' | 'redirected' | 'cancelled'> => {
      if (provider === 'apple' && (await isNativeAppleSignInAvailable())) {
        const identity = await requestAppleIdentity()
        if (!identity) return 'cancelled'
        const { error } = await authClient.linkSocial({ provider: 'apple', idToken: identity })
        if (error) throw new Error(error.code ?? error.message ?? 'could not link the account')
        return 'linked'
      }
      const { error } = await authClient.linkSocial({ provider, ...linkRedirects() })
      if (error) throw new Error(error.code ?? error.message ?? 'could not link the account')
      return 'redirected'
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SIGN_IN_METHODS_KEY }),
  })
}

/**
 * Disconnects one link. The server refuses to remove the last way in
 * (`allowUnlinkingAll` is off), and the screen does not offer the button in
 * that state — this is the guard behind the guard.
 */
export function useUnlinkProvider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await authClient.unlinkAccount({ accountId })
      if (error) throw new Error(error.code ?? error.message ?? 'could not unlink the account')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SIGN_IN_METHODS_KEY }),
  })
}
