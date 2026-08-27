import { useQueries } from '@tanstack/react-query'
import { api } from '../api/client'
import { keys } from '../api/queries'
import type { PublicProfileDto } from '../api/types'

/**
 * Resolves several user ids to profiles at once, sharing the same cache
 * entries the profile screen uses.
 *
 * The conversation list stores only participant ids, so every row needs a
 * name and an avatar from somewhere. `useQueries` keeps that as one hook call
 * regardless of row count — the alternative, a `useProfile` inside the row
 * component, breaks the rules of hooks the moment the list length changes and
 * refetches per render.
 */
export function useProfileCache(userIds: string[]): Record<string, PublicProfileDto | undefined> {
  const unique = [...new Set(userIds.filter(Boolean))]

  const results = useQueries({
    queries: unique.map((id) => ({
      queryKey: keys.profile(id),
      queryFn: () => api.get<PublicProfileDto>(`/profiles/${id}`),
      staleTime: 5 * 60_000,
    })),
  })

  const map: Record<string, PublicProfileDto | undefined> = {}
  unique.forEach((id, index) => {
    map[id] = results[index]?.data
  })
  return map
}
