import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { useCheckIn } from '../api/queries'
import { deviceDayKey } from '../lib/deviceDay'
import { useReviewPrompt } from './useReviewPrompt'

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
 * Loose in one direction only, which is why the key is `deviceDayKey` and not
 * `toISOString().slice(0, 10)`. The UTC day lags the local one east of
 * Greenwich — nine hours in Tokyo, three in Istanbul — so a process still
 * alive from last night held a key that said "asked already" through the first
 * hours of the new local day, and somebody who opened the app in the morning
 * and wrote nothing was never checked in at all.
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
  const review = useReviewPrompt()
  const requestReview = useRef(review.request)
  requestReview.current = review.request

  useEffect(() => {
    if (!enabled) return

    const ask = (): void => {
      const today = deviceDayKey()
      if (lastAsked.current === today) return
      lastAsked.current = today
      mutate.current(undefined, {
        // A failed check-in must be retryable, or a lost request costs a day.
        onError: () => {
          lastAsked.current = null
        },
        // The day a streak reaches a milestone is the best moment the app has
        // to ask for a review: the reward just landed, and somebody who is
        // here on day seven has been coming back for a week. Which days count
        // is read from the shared table, never typed here.
        onSuccess: (result) => {
          if (result.advanced) {
            requestReview.current({ kind: 'streakMilestone', day: result.current })
          }
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
