import type { SetPasswordInput, SignInMethods } from '@langx/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
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
