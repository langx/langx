import * as Linking from 'expo-linking'
import { useEffect, useState } from 'react'
import { inviteHandleFromUrl, inviteMayBeRemembered } from '../lib/inviteLink'
import { FLAG_KEYS, writeFlag } from '../lib/localFlags'

/**
 * Remembers whose invite link opened the app, for onboarding to send later.
 *
 * Mounted above `Stack.Protected`, not inside `(app)`: the entire point is
 * that the reader has no account yet, so a hook that only runs once somebody
 * is signed in would never see the link that brought them.
 *
 * It writes a flag and navigates nothing. That is what makes mounting it that
 * high safe — routing from here would race the router's own handling of the
 * same URL, and the two would disagree about where a marked profile link goes.
 *
 * Both halves are needed and they are different events: `getInitialURL` is the
 * cold start, where the link *is* the launch, and the listener is the app
 * already running when the link is tapped.
 *
 * This is the native half. `APP_LINK_HOST` and `WEB_HOST` are the same host,
 * which the app claims through its associated domains and Android intent
 * filters, so on a phone with the app installed an invite link opens the app
 * and arrives here. Without the app, and on the web build, the link opens in a
 * browser instead, and `app/[username].tsx` writes the same flag from the
 * screen it lands on.
 */
export function usePendingInvite(session: {
  settled: boolean
  user: { isAnonymous?: boolean | null | undefined } | null | undefined
}): void {
  // Captured as soon as the link arrives, written only once the session says
  // whose launch this is: on a cold start the URL usually resolves first.
  const [handle, setHandle] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const capture = (url: string | null | undefined) => {
      const found = inviteHandleFromUrl(url)
      if (found && !cancelled) setHandle(found)
    }

    void Linking.getInitialURL().then(capture)
    const subscription = Linking.addEventListener('url', (event) => capture(event.url))
    return () => {
      cancelled = true
      subscription.remove()
    }
  }, [])

  // Decided once, the first time the session is known, and dropped either
  // way: a member's link kept waiting would be written the moment they sign
  // out, which is the leak this check exists to close.
  const { settled } = session
  const remember = inviteMayBeRemembered(session)
  useEffect(() => {
    if (!handle || !settled) return
    if (remember) void writeFlag(FLAG_KEYS.pendingReferrer, handle)
    setHandle(null)
  }, [handle, settled, remember])
}
