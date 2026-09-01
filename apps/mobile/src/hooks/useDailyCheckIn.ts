import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { useCheckIn } from '../api/queries'

/**
 * Tells the server the app was opened, so today counts towards the streak.
 *
 * `AppState`, not a timer and not a screen mount: the question is "did this
 * person come back today", and coming back is exactly a foreground transition.
 * Mounted once in the signed-in layout, alongside the socket and the location
 * refresh, for the reason that file gives — a hook living on one screen only
 * fires for people who happen to open that screen.
 *
 * Fired at most once per calendar day per launch. The server is idempotent
 * either way — the second call finds the day already credited — so this is
 * about not making a request per app switch rather than about correctness. The
 * day is the device's own, deliberately loose: the server owns the real answer
 * in the user's stored timezone, and this only decides whether to ask.
 *
 * Never for a guest. A guest has no profile to hold a streak.
 */
export function useDailyCheckIn({ enabled }: { enabled: boolean }) {
  const checkIn = useCheckIn()
  const lastAsked = useRef<string | null>(null)
  // The mutation object is new every render; a ref keeps the effect from
  // resubscribing to `AppState` on each one.
  const mutate = useRef(checkIn.mutate)
  mutate.current = checkIn.mutate

  useEffect(() => {
    if (!enabled) return

    const ask = (): void => {
      const today = new Date().toISOString().slice(0, 10)
      if (lastAsked.current === today) return
      lastAsked.current = today
      mutate.current(undefined, {
        // A failed check-in must be retryable, or a lost request costs a day.
        onError: () => {
          lastAsked.current = null
        },
      })
    }

    ask()
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') ask()
    })
    return () => subscription.remove()
  }, [enabled])
}
