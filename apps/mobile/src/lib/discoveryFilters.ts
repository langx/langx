import { DISCOVERY_PRO_FILTER_KEYS, type LanguageLevel, type Gender } from '@langx/shared'

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
  /** Free. Their level in my language, as an inclusive band. */
  minLevel?: LanguageLevel
  maxLevel?: LanguageLevel
  /** Free. */
  ageMin?: number
  ageMax?: number
  /** Free. */
  country?: string
  /**
   * Free, and the only gender filter that is: it names the caller's own
   * gender rather than anybody else's, and the server resolves it from their
   * profile. See `DISCOVERY_PRO_FILTER_KEYS`.
   */
  onlyMyGender?: boolean
  // Pro from here down — see `DISCOVERY_PRO_FILTER_KEYS`, which is the one
  // list, and which the server answers 403 against rather than ignoring the
  // parameter.
  gender?: Gender
  /** Pro. */
  /**
   * A canonical id, plus the name to draw on the chip — the picker knows both
   * and the id alone would leave the filter row unable to say what it is
   * filtering by without a lookup.
   */
  cityId?: string
  cityName?: string
}

/**
 * The two-handled age slider's bounds (v3). The right handle at `sliderMax`
 * means "no upper bound" — it renders as `55+` and sends no `ageMax` — so the
 * slider can express the same open end the old `55+` bracket did.
 */
export const AGE_SLIDER = { min: 18, max: 55 } as const

/*
 * The shared list, not a copy of it. This file used to keep its own, with a
 * comment noting the server had "its copy" — two lists that had to be edited
 * together, where forgetting the client's means a paywall that never opens and
 * forgetting the server's means a filter that 403s from a screen that offered
 * it.
 */
const PRO_KEYS = DISCOVERY_PRO_FILTER_KEYS

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

  const gender = one(params.gender)
  if (gender) filters.gender = gender as Gender
  if (one(params.onlyMyGender) === '1') filters.onlyMyGender = true
  const country = one(params.country)
  if (country) filters.country = country
  const minLevel = one(params.minLevel)
  if (minLevel) filters.minLevel = minLevel as LanguageLevel
  const maxLevel = one(params.maxLevel)
  if (maxLevel) filters.maxLevel = maxLevel as LanguageLevel

  const ageMin = Number(one(params.ageMin))
  if (Number.isInteger(ageMin) && ageMin > 0) filters.ageMin = ageMin
  const ageMax = Number(one(params.ageMax))
  if (Number.isInteger(ageMax) && ageMax > 0) filters.ageMax = ageMax
  const cityId = one(params.cityId)?.trim()
  const cityName = one(params.cityName)?.trim()
  if (cityId) filters.cityId = cityId
  if (cityId && cityName) filters.cityName = cityName

  return filters
}

/** Route params. Only what is set — an empty string in a URL is still a filter. */
export function toParams(filters: DiscoveryFilters): Record<string, string> {
  const params: Record<string, string> = {}
  if (filters.targetLanguage) params.targetLanguage = filters.targetLanguage
  if (filters.gender) params.gender = filters.gender
  if (filters.onlyMyGender) params.onlyMyGender = '1'
  if (filters.country) params.country = filters.country
  if (filters.minLevel) params.minLevel = filters.minLevel
  if (filters.maxLevel) params.maxLevel = filters.maxLevel
  if (filters.ageMin !== undefined) params.ageMin = String(filters.ageMin)
  if (filters.ageMax !== undefined) params.ageMax = String(filters.ageMax)
  if (filters.cityId) params.cityId = filters.cityId
  if (filters.cityName) params.cityName = filters.cityName
  return params
}

/**
 * The API query. `onlyMyGender` goes over the wire as `true`, which is what
 * `z.coerce.boolean()` on the other side reads — `'1'` is the URL's spelling,
 * not the API's.
 */
export function toQuery(filters: DiscoveryFilters): Record<string, string> {
  const query: Record<string, string> = {}
  if (filters.targetLanguage) query.targetLanguage = filters.targetLanguage
  if (filters.gender) query.gender = filters.gender
  if (filters.onlyMyGender) query.onlyMyGender = 'true'
  if (filters.country) query.country = filters.country
  if (filters.minLevel) query.minLevel = filters.minLevel
  if (filters.maxLevel) query.maxLevel = filters.maxLevel
  if (filters.ageMin !== undefined) query.ageMin = String(filters.ageMin)
  if (filters.ageMax !== undefined) query.ageMax = String(filters.ageMax)
  if (filters.cityId) query.cityId = filters.cityId
  return query
}

/** How many filters are on, for the badge on the Discover chip. */
export function activeCount(filters: DiscoveryFilters): number {
  let count = 0
  if (filters.targetLanguage) count++
  if (filters.gender || filters.onlyMyGender) count++
  if (filters.country) count++
  // One level *band*, however many bounds express it.
  if (filters.minLevel || filters.maxLevel) count++
  // One age *range*, however many bounds express it.
  if (filters.ageMin !== undefined || filters.ageMax !== undefined) count++
  if (filters.cityId) count++
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
  if (filters.minLevel) free.minLevel = filters.minLevel
  if (filters.maxLevel) free.maxLevel = filters.maxLevel
  if (filters.ageMin !== undefined) free.ageMin = filters.ageMin
  if (filters.ageMax !== undefined) free.ageMax = filters.ageMax
  if (filters.country) free.country = filters.country
  // Free since the paywall stopped running through the middle of the gender
  // pair. An allow-list is the safe shape for this function — a key nobody
  // remembers to add is dropped, not leaked — but it does mean a filter that
  // *becomes* free has to be added here as well as removed from `PRO_KEYS`,
  // and forgetting shows up only as a filter that silently stops applying.
  if (filters.onlyMyGender) free.onlyMyGender = filters.onlyMyGender
  return free
}
