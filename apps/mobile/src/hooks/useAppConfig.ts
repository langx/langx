import { type AppConfigResponse } from '@langx/shared'
import { useQuery } from '@tanstack/react-query'
import { AppState } from 'react-native'
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'

export { appPlatform, appVersion, versionHeaders } from '../lib/appVersion'

export const APP_CONFIG_KEY = ['app-config'] as const

/**
 * The server's word on whether the app should be running at all.
 *
 * Refetched when the app returns to the foreground, not on a timer: someone who
 * left the app open overnight should learn about maintenance when they come
 * back to it, and polling in the background would spend battery to find out
 * nothing almost every time.
 *
 * Failures are deliberately not surfaced. If this request cannot be made, the
 * app carries on — a config endpoint that is unreachable must never be the
 * reason a working app refuses to start.
 */
export function useAppConfig() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void queryClient.invalidateQueries({ queryKey: APP_CONFIG_KEY })
    })
    return () => subscription.remove()
  }, [queryClient])

  return useQuery({
    queryKey: APP_CONFIG_KEY,
    queryFn: () => api.get<AppConfigResponse>('/app-config'),
    staleTime: 60_000,
    retry: 1,
  })
}
