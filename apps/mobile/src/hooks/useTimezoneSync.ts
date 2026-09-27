import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { useMe, useUpdateProfile } from '../api/queries'
import { timezoneToSync } from '../lib/timezoneSync'

/**
 * Keeps the profile's timezone matching the device's, on foreground.
 *
 * Onboarding writes the zone once, and nothing wrote it again — so every
 * account from before that, and every one that came over from v1, has none,
 * and the chat header has no clock to show for them. The device already knows
 * the answer; asking would be a question with only one right reply.
 *
 * Foreground rather than launch only, for the same reason as
 * `useLocationRefresh`: somebody who lands in a new zone should carry it the
 * first time they open the app there.
 *
 * Silent throughout. A refusal is the server's timezone cooldown (it guards the
 * streak's local day) or a network failure, and neither is something the user
 * asked about — the next foreground simply tries again.
 */
export function useTimezoneSync({ enabled = true }: { enabled?: boolean } = {}): void {
  const me = useMe()
  // `mutate` alone, not the mutation object: that one changes with every state
  // it passes through, and as a dependency below a refused write would re-run
  // the effect and send itself again, for as long as the refusal lasted.
  const { mutate } = useUpdateProfile()
  // Foregrounding twice in quick succession is ordinary, and would be two writes.
  const busy = useRef(false)

  const loaded = me.data !== undefined
  const profileZone = me.data?.timezone
  const updatedAt = me.data?.timezoneUpdatedAt

  useEffect(() => {
    if (!enabled || !loaded) return
    function sync(): void {
      if (busy.current) return
      const zone = timezoneToSync({
        deviceZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        profileZone,
        timezoneUpdatedAt: updatedAt,
      })
      if (zone === null) return
      busy.current = true
      mutate(
        { timezone: zone },
        {
          onSettled: () => {
            busy.current = false
          },
        },
      )
    }

    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') sync()
    })
    // Once on mount too: the app is already foreground when this first runs.
    sync()
    return () => subscription.remove()
  }, [enabled, loaded, profileZone, updatedAt, mutate])
}
