import { useEffect, useRef, useState } from 'react'
import { ApiRequestError, api } from '../api/client'
import { authClient } from '../lib/auth-client'
import { isRestoredGuestSession } from '../lib/guestGate'

/**
 * Deletes a guest who left before answering anything.
 *
 * Tapping "look around" mints an anonymous account immediately, because that is
 * what lets somebody see the app without handing over an email. Most of those
 * taps end there — the app is closed a screen later — and what stays behind is
 * a `user` row that will never be read again, with a session attached to it.
 * Nothing else would collect them: the hourly sweep looks for a guest
 * *profile*, and this guest never got far enough to have one.
 *
 * **Only the ones with nothing behind them.** Picking two languages writes a
 * guest profile, and somebody with one is browsing — closing the app and
 * opening it again should put them back where they were, not throw the session
 * away and ask again. So the profile is the line, and the server draws it: a
 * 404 from `/profiles/me` is "answered nothing", and it is the same 404 the
 * root gate reads.
 *
 * Anything other than a 404 — offline, a 5xx — leaves the session alone. It is
 * not evidence of an abandoned guest, and being wrong in that direction only
 * costs a row the sweep will take later; being wrong the other way signs
 * somebody out mid-visit.
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
    const restored = isRestoredGuestSession({
      settled,
      seenBefore: seenBefore.current,
      user: session?.user,
    })
    if (settled) seenBefore.current = true
    if (!restored) return

    setResetting(true)
    void (async () => {
      if (await answeredSomething()) return
      await endGuestSession()
      /*
       * The session the client holds has to agree with the server, and
       * `signOut` is not enough on its own: the row it wants to delete is
       * already gone, so the server answers it with an error and the client
       * keeps the guest in hand. Refetching gets the `null` that ends the
       * session locally however sign-out went.
       */
      await refetch()
    })().finally(() => setResetting(false))
    // `isPending` alone would miss the resolution that arrives with the data
    // in the same tick.
  }, [isPending, session, refetch])

  return { resetting }
}

/**
 * Whether this guest got as far as a profile.
 *
 * A second `/profiles/me` — the root gate asks the same question a moment
 * later through `useMe`. It cannot be shared: this runs above
 * `QueryClientProvider`, which is mounted inside the same component, and it
 * has to answer before the navigator is built. One request on a guest's cold
 * start is the price.
 */
async function answeredSomething(): Promise<boolean> {
  try {
    await api.get('/profiles/me')
    return true
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) return false
    return true
  }
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
