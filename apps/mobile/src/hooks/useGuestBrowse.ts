import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { keys } from '../api/queries'
import { useT } from '../i18n'
import { showAlert } from '../lib/alert'
import { authClient } from '../lib/auth-client'
import { shouldGateGuest } from '../lib/guestGate'

/**
 * Starting to look around without an account.
 *
 * A hook rather than a function on the welcome screen, because two screens
 * offer this now and the hard part is not the sign-in call — it is the two
 * failure shapes and the fact that the navigation cannot happen inline. A
 * second copy of that would drift, and the way it would drift is silently: a
 * screen that starts a guest session and then does not move.
 */
export function useGuestBrowse(): { start: () => Promise<void>; starting: boolean } {
  const t = useT()
  const { data: session } = authClient.useSession()
  const queryClient = useQueryClient()
  const [starting, setStarting] = useState(false)
  /*
   * Whether *this hook* is the reason there is a guest session. A ref rather
   * than `starting`, which is cleared only on failure and would still be true
   * at the moment the effect below wants to read it.
   */
  const started = useRef(false)

  async function start(): Promise<void> {
    if (starting) return
    setStarting(true)
    /*
     * `try`, not just the returned `error`. Better Auth's client returns one
     * for a rejected *request*, and throws for a failed *connection* — the
     * offline case is the throw, and it is also the likeliest one on a first
     * launch. Catching only the first left an uncaught error on the very first
     * screen somebody sees.
     */
    const failed = await authClient.signIn
      .anonymous()
      .then(({ error }) => Boolean(error))
      .catch(() => true)
    if (failed) {
      setStarting(false)
      await showAlert(t('welcome.guestFailed'), t('common.retry'))
      return
    }
    started.current = true
    /*
     * The session changed, so anything cached under the previous one is about
     * to be answered differently — the gate reads `useMe` to decide where to
     * send them, and a stale 404 or a stale profile would send them to the
     * wrong place.
     */
    await queryClient.invalidateQueries({ queryKey: keys.me })
    // The effect below does the navigating; see why there.
  }

  /*
   * Navigating from inside `start()` does not work, and neither of the two
   * obvious targets does either.
   *
   * `/(onboarding)/languages` fails because at that instant `useSession` has
   * not re-rendered the root layout, so `(onboarding)` is not mounted and the
   * replace silently does nothing. And `/` is the gate, which at that instant
   * still reads a session that is not there yet.
   *
   * So it waits for the session to actually exist, which is also the only
   * moment the destination is guaranteed to be mounted.
   *
   * `started` is what keeps this a consequence of the tap rather than of the
   * session. Without it the effect fired on every mount that happened to hold
   * a guest session, and both screens that use this hook stay mounted for a
   * guest: opening `(auth)/sign-in` bounced straight to the language step, so
   * a guest could not sign into the account they already had.
   */
  useEffect(() => {
    if (started.current && shouldGateGuest(session?.user)) {
      router.replace('/(onboarding)/languages')
    }
  }, [session])

  return { start, starting }
}
