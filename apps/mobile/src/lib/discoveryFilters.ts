import type { LanguageLevel, Gender } from '@langx/shared'

/**
 * Discovery filters, and the translation between the filter screen, the URL
 * and the API query.
 *
 * They live in the **route's search params** rather than in a store, for two
 * reasons. The filter screen is pushed on top of Discover and has to hand its
 * result back, which params do without a global; and this app ships a real web
 * build, where a filtered search that survives a reload and can be pasted to
 * someone is worth having for free.
 */
export interface DiscoveryFilters {
  /** Free. One of the viewer's own learning languages. */
  targetLanguage?: string
  /** Free. */
  online?: boolean
  // Pro from here down — `DISCOVERY_PRO_FILTER_KEYS` is the server's copy of
  // this list, and it answers with 403 rather than ignoring the parameter.
  gender?: Gender
  onlyMyGender?: boolean
  country?: string
  minLevel?: LanguageLevel
  ageMin?: number
  ageMax?: number
}

/** The named brackets the age filter offers instead of a two-handled slider. */
export const AGE_BRACKETS = [
  { label: '18–24', ageMin: 18, ageMax: 24 },
  { label: '25–34', ageMin: 25, ageMax: 34 },
  { label: '35–44', ageMin: 35, ageMax: 44 },
  { label: '45–54', ageMin: 45, ageMax: 54 },
  { label: '55+', ageMin: 55 },
] as const

const PRO_KEYS = ['gender', 'onlyMyGender', 'country', 'minLevel', 'ageMin', 'ageMax'] as const

function one(value: string | string[] | undefined): string | undefined {
  const first = Array.isArray(value) ? value[0] : value
  return first && first.length > 0 ? first : undefined
}

export function parseFilters(
  params: Record<string, string | string[] | undefined>,
): DiscoveryFilters {
  const filters: DiscoveryFilters = {}
  const target = one(params.targetLanguage)
  if (target) filters.targetLanguage = target
  if (one(params.online) === '1') filters.online = true

  const gender = one(params.gender)
  if (gender) filters.gender = gender as Gender
  if (one(params.onlyMyGender) === '1') filters.onlyMyGender = true
  const country = one(params.country)
  if (country) filters.country = country
  const minLevel = one(params.minLevel)
  if (minLevel) filters.minLevel = minLevel as LanguageLevel

  const ageMin = Number(one(params.ageMin))
  if (Number.isInteger(ageMin) && ageMin > 0) filters.ageMin = ageMin
  const ageMax = Number(one(params.ageMax))
  if (Number.isInteger(ageMax) && ageMax > 0) filters.ageMax = ageMax

  return filters
}

/** Route params. Only what is set — an empty string in a URL is still a filter. */
export function toParams(filters: DiscoveryFilters): Record<string, string> {
  const params: Record<string, string> = {}
  if (filters.targetLanguage) params.targetLanguage = filters.targetLanguage
  if (filters.online) params.online = '1'
  if (filters.gender) params.gender = filters.gender
  if (filters.onlyMyGender) params.onlyMyGender = '1'
  if (filters.country) params.country = filters.country
  if (filters.minLevel) params.minLevel = filters.minLevel
  if (filters.ageMin !== undefined) params.ageMin = String(filters.ageMin)
  if (filters.ageMax !== undefined) params.ageMax = String(filters.ageMax)
  return params
}

/**
 * The API query. `online` and `onlyMyGender` go over the wire as `true`, which
 * is what `z.coerce.boolean()` on the other side reads — `'1'` is the URL's
 * spelling, not the API's.
 */
export function toQuery(filters: DiscoveryFilters): Record<string, string> {
  const query: Record<string, string> = {}
  if (filters.targetLanguage) query.targetLanguage = filters.targetLanguage
  if (filters.online) query.online = 'true'
  if (filters.gender) query.gender = filters.gender
  if (filters.onlyMyGender) query.onlyMyGender = 'true'
  if (filters.country) query.country = filters.country
  if (filters.minLevel) query.minLevel = filters.minLevel
  if (filters.ageMin !== undefined) query.ageMin = String(filters.ageMin)
  if (filters.ageMax !== undefined) query.ageMax = String(filters.ageMax)
  return query
}

/** How many filters are on, for the badge on the Discover chip. */
export function activeCount(filters: DiscoveryFilters): number {
  let count = 0
  if (filters.targetLanguage) count++
  if (filters.online) count++
  if (filters.gender || filters.onlyMyGender) count++
  if (filters.country) count++
  if (filters.minLevel) count++
  // One age *range*, however many bounds express it.
  if (filters.ageMin !== undefined || filters.ageMax !== undefined) count++
  return count
}

/**
 * Whether these filters would be refused for a free account. Used to strip
 * them rather than let the request come back 403 — a free user who somehow
 * holds a Pro filter (a pasted URL, or a lapsed subscription) should see an
 * unfiltered list, not an error page.
 */
export function hasProFilters(filters: DiscoveryFilters): boolean {
  return PRO_KEYS.some((key) => filters[key] !== undefined)
}

export function withoutProFilters(filters: DiscoveryFilters): DiscoveryFilters {
  const free: DiscoveryFilters = {}
  if (filters.targetLanguage) free.targetLanguage = filters.targetLanguage
  if (filters.online) free.online = true
  return free
}
