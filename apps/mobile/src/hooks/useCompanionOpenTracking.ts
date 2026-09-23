import * as Linking from 'expo-linking'
import { useEffect } from 'react'
import { track } from '../lib/analytics'
import { companionOpenFromUrl } from '../lib/companionOpen'

/**
 * Counts the app being opened from the Live Activity or a widget.
 *
 * The measuring half of phase 7 — see `companionOpenFromUrl` for why a URL is
 * enough to tell the surfaces apart. Mounted at the root beside
 * `usePendingInvite`, which reads links the same way, so a cold start from a
 * tap is counted as well as a tap that brings a running app forward.
 */
export function useCompanionOpenTracking(): void {
  useEffect(() => {
    const record = (url: string | null | undefined) => {
      const open = companionOpenFromUrl(url)
      if (open) track({ name: 'companion_opened', properties: open })
    }

    void Linking.getInitialURL().then(record)
    const subscription = Linking.addEventListener('url', (event) => record(event.url))
    return () => subscription.remove()
  }, [])
}
