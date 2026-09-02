import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import { authClient } from '../lib/auth-client'
import { shouldEndGuestSession } from '../lib/guestGate'

/**
 * Ends a guest session that survived the app being closed.
 *
 * Looking around without an account is a thing you do in one sitting: a guest
 * owns nothing, cannot write, and the only thing they have filled in — the two
 * language questions — lives in the device-side onboarding draft, which
 * outlives this and is restored the moment they tap "look around" again. So
 * the session buys nothing across a launch, and it costs plenty: while it
 * exists at boot, both `Stack.Protected` branches are mounted and `/` matches
 * two screens at once, which is how a returning guest ended up on a spinner
 * with no way forward. See `shouldEndGuestSession` for the routing detail.
 *
 * Deleting rather than only signing out, because nothing else would ever
 * collect the rows: a guest who never reached the language step has no
 * `profiles` document, and the hourly sweep used to be keyed on exactly that.
 */
export function useGuestSessionReset(): { resetting: boolean } {
  const { data: session, isPending, refetch } = authClient.useSession()
  const [resetting, setResetting] = useState(false)
  // Not state: this must not itself cause a render, and what it records is
  // "the session has been observed once", which is true from the moment it
  // happens rather than from the next paint.
  const seenBefore = useRef(false)

  useEffect(() => {
    const settled = !isPending
    const end = shouldEndGuestSession({
      settled,
      seenBefore: seenBefore.current,
      user: session?.user,
    })
    if (settled) seenBefore.current = true
    if (!end) return

    setResetting(true)
    void endGuestSession()
      .then(() => {
        /*
         * The session the client holds has to agree with the server, and
         * `signOut` is not enough on its own: the row it wants to delete is
         * already gone, so the server answers it with an error and the client
         * keeps the guest in hand. Refetching gets the `null` that ends the
         * session locally however sign-out went.
         */
        void refetch()
      })
      .finally(() => setResetting(false))
    // `isPending` alone would miss the resolution that arrives with the data
    // in the same tick.
  }, [isPending, session, refetch])

  return { resetting }
}

async function endGuestSession(): Promise<void> {
  /*
   * Delete first, sign out second. The other order cannot work: signing out
   * invalidates the very cookie that authenticates the delete, and the guest
   * would be left behind in `user` for thirty days.
   */
  try {
    await api.delete('/profiles/guest')
  } catch {
    // A guest that could not be deleted is still a guest that must not stay
    // signed in. The rows are the sweep's problem; the person is this one's.
  }
  try {
    await authClient.signOut()
  } catch {
    // Expected when the delete above succeeded — the session row it wants is
    // gone. Worth calling anyway: when it does work it is what clears the
    // stored cookie on native.
  }
}
