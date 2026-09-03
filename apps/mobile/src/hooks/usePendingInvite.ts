import * as Linking from 'expo-linking'
import { useEffect } from 'react'
import { inviteHandleFromUrl } from '../lib/inviteLink'
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
 * Today this is mostly dormant. `APP_LINK_HOST` is `app.langx.io` — what the
 * app claims in its association files — while shared links point at
 * `WEB_HOST`, `app.langx.io`, so on a phone an invite link opens the browser
 * rather than the app. The web build is where it actually fires, and
 * `app/[username].tsx` covers that case directly. This is written now so that
 * the day the hosts converge, the flow already works.
 */
export function usePendingInvite(): void {
  useEffect(() => {
    let cancelled = false
    const remember = (url: string | null | undefined) => {
      const handle = inviteHandleFromUrl(url)
      if (handle && !cancelled) void writeFlag(FLAG_KEYS.pendingReferrer, handle)
    }

    void Linking.getInitialURL().then(remember)
    const subscription = Linking.addEventListener('url', (event) => remember(event.url))
    return () => {
      cancelled = true
      subscription.remove()
    }
  }, [])
}
