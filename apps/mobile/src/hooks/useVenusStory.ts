import { VENUS_STORY_MEDIA } from '@langx/shared'
import { useQuery } from '@tanstack/react-query'
import { useTokens } from '../api/queries'
import { useLocale } from '../i18n'
import { deviceDayKey } from '../lib/deviceDay'
import {
  parseVenusManifest,
  venusVideoFor,
  type VenusManifest,
  type VenusVideo,
} from '../lib/venusStory'
import { useAppConfig } from './useAppConfig'

/**
 * The bucket's address, from the shared config only. An environment override
 * for dev builds was tried and dropped: CodeQL reads any outside value in a
 * fetch URL as request forgery, and a dev build can point the config at a
 * local folder just as well.
 */
export const VENUS_MEDIA_URL = VENUS_STORY_MEDIA.baseUrl.replace(/\/+$/, '')

/**
 * Whether `flags.venusStories` is on, and the bucket's manifest once it has
 * arrived — `undefined` with the flag off, while it is on its way, or when it
 * could not be read.
 *
 * The manifest is fetched straight from the bucket, not through the API: it
 * is a public file beside the videos. A failure is silent and not retried —
 * until the files are uploaded every request for it fails, and that has to
 * look exactly like the feature not being there.
 */
export function useVenusManifest(): { on: boolean; manifest: VenusManifest | undefined } {
  const on = useAppConfig().data?.flags.venusStories === true
  const manifest = useQuery({
    // `2`: the entries carry their cover since it was added, and a cache
    // written to disk by a build before that holds a bare list of names.
    queryKey: ['venus-manifest', 2, VENUS_MEDIA_URL],
    queryFn: async () => {
      const response = await fetch(`${VENUS_MEDIA_URL}/${VENUS_STORY_MEDIA.manifest}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      // A list in the cache, a map to read: the query cache may be written to
      // disk as JSON, where a `Map` would come back as `{}`.
      return [...parseVenusManifest(await response.json())]
    },
    select: (entries: [string, string | null][]) => new Map(entries),
    enabled: on,
    retry: false,
    // A new day's file is uploaded once, far ahead of anybody reaching it.
    staleTime: 6 * 60 * 60 * 1000,
  })
  return { on, manifest: on ? manifest.data : undefined }
}

/**
 * Today's Venus video for the signed-in person, or `null` — with the flag
 * off, before today counts, for a day or locale the bucket does not hold, or
 * while any of the three answers is still on its way.
 */
export function useVenusStory(): VenusVideo | null {
  const { on, manifest } = useVenusManifest()
  const tokens = useTokens()
  const { locale } = useLocale()
  if (!on) return null
  return venusVideoFor({
    streak: tokens.data?.streak,
    locale,
    manifest,
    baseUrl: VENUS_MEDIA_URL,
    deviceToday: deviceDayKey(),
  })
}
