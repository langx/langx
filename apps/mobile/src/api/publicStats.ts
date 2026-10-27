import { PUBLIC_STATS_TTL_MS, publicStatsSchema } from '@langx/shared'
import { useQuery } from '@tanstack/react-query'
import { api } from './client'

export const PUBLIC_STATS_KEY = ['publicStats'] as const

/**
 * The public counters behind the Transparency page — `GET /public/stats`,
 * which needs no session, so a guest reads exactly what an account does.
 *
 * In a file of its own rather than in `queries.ts`, beside the operator
 * panel's hooks: the page is public, and what it may show is decided by that
 * endpoint alone (`docs/insight.md`). `transparencyScreen.test.ts` holds the
 * screen to this file and away from anything of the panel's.
 *
 * Kept for as long as the server keeps its own answer: asking again inside
 * those ten minutes cannot see a different number. Parsed with the shared
 * schema, so an answer of the wrong shape is a load failure the page can say,
 * not a `NaN` drawn in a total.
 */
export function usePublicStats() {
  return useQuery({
    queryKey: PUBLIC_STATS_KEY,
    queryFn: async () => publicStatsSchema.parse(await api.get<unknown>('/public/stats')),
    staleTime: PUBLIC_STATS_TTL_MS,
  })
}
