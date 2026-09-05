import type { SetPasswordInput, SignInMethods } from '@langx/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

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
