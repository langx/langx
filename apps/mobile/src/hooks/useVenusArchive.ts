import { useMemo } from 'react'
import { useTokens } from '../api/queries'
import { useLocale } from '../i18n'
import { authClient } from '../lib/auth-client'
import { streakRowVenus } from '../lib/venusStreakRow'
import {
  venusArchive,
  venusUnlockedDays,
  type VenusArchiveDay,
  type VenusVideo,
} from '../lib/venusStory'
import { useVenusManifest, useVenusStory, VENUS_MEDIA_URL } from './useVenusStory'
import { useVenusWatched } from './useVenusWatched'

export interface VenusArchiveView {
  /** Every day the bucket holds in the app's language, open or not (`venusArchive`). */
  days: readonly VenusArchiveDay[]
  /** Today's video, when today has counted and the bucket holds it. */
  today: VenusVideo | null
  /**
   * Today's video has not been watched to its end on this device — Home's
   * own reading (`streakRowVenus`), so the dot on the strip and the dot on
   * Home's Venus card come and go together.
   */
  todayUnwatched: boolean
}

/**
 * Venus's archive for the signed-in person: which of her days they can watch
 * again, and today's. `null` whenever there is nothing to draw — the flag
 * off, the manifest not in, no day in this language, the streak not known —
 * so a caller draws its strip or grid only on an answer, and a failure looks
 * exactly like the feature not being there, as `useVenusStory`'s does.
 *
 * For an account: a guest has no streak, and the player at the root does not
 * open for one (`VenusStoryHost`'s `enabled`).
 */
export function useVenusArchive(): VenusArchiveView | null {
  const { on, manifest } = useVenusManifest()
  const tokens = useTokens()
  const today = useVenusStory()
  const watched = useVenusWatched()
  const { data: session } = authClient.useSession()
  const { locale } = useLocale()
  const streak = tokens.data?.streak
  const unlocked = venusUnlockedDays(streak)

  const days = useMemo(
    () => (manifest ? venusArchive({ manifest, locale, baseUrl: VENUS_MEDIA_URL, unlocked }) : []),
    [manifest, locale, unlocked],
  )

  if (!on || !streak || days.length === 0) return null
  return {
    days,
    today,
    todayUnwatched: streakRowVenus(today, watched, session?.user.id) === 'ready',
  }
}
