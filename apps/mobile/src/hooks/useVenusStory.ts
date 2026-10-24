import { VENUS_STORY_MEDIA } from '@langx/shared'
import { useQuery } from '@tanstack/react-query'
import { useTokens } from '../api/queries'
import { useLocale } from '../i18n'
import { deviceDayKey } from '../lib/deviceDay'
import { parseVenusManifest, venusVideoFor, type VenusVideo } from '../lib/venusStory'
import { useAppConfig } from './useAppConfig'

/**
 * The bucket's address. `EXPO_PUBLIC_VENUS_MEDIA_URL` points a dev build at a
 * local folder or the dev bucket; every other build reads the shared config.
 */
export const VENUS_MEDIA_URL = (
  process.env.EXPO_PUBLIC_VENUS_MEDIA_URL || VENUS_STORY_MEDIA.baseUrl
).replace(/\/+$/, '')

/**
 * Today's Venus video for the signed-in person, or `null` — with the flag
 * off, before today counts, for a day or locale the bucket does not hold, or
 * while any of the three answers is still on its way.
 *
 * The manifest is fetched straight from the bucket, not through the API: it
 * is a public file beside the videos. A failure is silent and not retried —
 * until the files are uploaded every request for it fails, and that has to
 * look exactly like the feature not being there.
 */
export function useVenusStory(): VenusVideo | null {
  const on = useAppConfig().data?.flags.venusStories === true
  const tokens = useTokens()
  const { locale } = useLocale()
  const manifest = useQuery({
    queryKey: ['venus-manifest', VENUS_MEDIA_URL],
    queryFn: async () => {
      const response = await fetch(`${VENUS_MEDIA_URL}/${VENUS_STORY_MEDIA.manifest}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      // A list in the cache, a set to read: the query cache may be written to
      // disk as JSON, where a `Set` would come back as `{}`.
      return [...parseVenusManifest(await response.json())]
    },
    select: (names: string[]) => new Set(names),
    enabled: on,
    retry: false,
    // A new day's file is uploaded once, far ahead of anybody reaching it.
    staleTime: 6 * 60 * 60 * 1000,
  })
  if (!on) return null
  return venusVideoFor({
    streak: tokens.data?.streak,
    locale,
    manifest: manifest.data,
    baseUrl: VENUS_MEDIA_URL,
    deviceToday: deviceDayKey(),
  })
}
