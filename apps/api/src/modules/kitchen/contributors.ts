import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'

/** One person on the repository's contributor list. */
export interface Contributor {
  login: string
  avatarUrl: string
  /** Their GitHub profile. */
  url: string
}

export interface ContributorsView {
  /** Everyone, bots excluded — the "+N" the strip ends with is this minus `top`. */
  total: number
  /** The most active, most first, as many as the strip draws. */
  top: Contributor[]
}

/** The repository whose contributors Our Kitchen shows. */
export const CONTRIBUTORS_REPO = 'langx/langx'
/** Six faces and a "+N" is what the design draws. */
export const CONTRIBUTORS_TOP = 6
/**
 * How long a good answer is reused before GitHub is asked again. The list
 * moves by a name or two a week; six hours keeps the unauthenticated rate
 * limit (60 requests an hour, shared across everything this process does)
 * from ever being the thing that decides whether the strip is drawn.
 */
export const CONTRIBUTORS_TTL_MS = 6 * 60 * 60 * 1000
/** Contributors come 100 to a page; the repository is nowhere near three pages. */
const MAX_PAGES = 3

interface CachedContributors {
  _id: string
  fetchedAt: Date
  view: ContributorsView
}

const EMPTY: ContributorsView = { total: 0, top: [] }

/**
 * The last good answer, per process. Mongo holds the same thing across
 * processes and restarts; this saves the round trip for the common case.
 */
let memory: CachedContributors | null = null

/** Test only: forget the in-process answer, so a test starts from Mongo or GitHub. */
export function resetContributorsCache(): void {
  memory = null
}

/**
 * One row of GitHub's answer, read defensively: the body is whatever came
 * back, and a shape this code did not expect is skipped rather than trusted.
 * Dependabot and friends are on the list too; they did not contribute in the
 * sense the strip means.
 */
function asContributor(row: unknown): Contributor | null {
  if (typeof row !== 'object' || row === null) return null
  const record = row as Record<string, unknown>
  if (record.type === 'Bot') return null
  const { login, avatar_url: avatarUrl, html_url: url } = record
  if (typeof login !== 'string' || typeof avatarUrl !== 'string' || typeof url !== 'string') {
    return null
  }
  return { login, avatarUrl, url }
}

/**
 * Who has contributed to the repository, for the strip on Our Kitchen.
 *
 * GitHub is the only source there is, and it is neither fast nor always
 * willing (an hour of rate limit is routine without a token). So the answer is
 * kept — in this process and in a single Mongo document — and GitHub is asked
 * only when what is kept is older than `CONTRIBUTORS_TTL_MS`. When GitHub
 * refuses, the stale answer is served rather than nothing; only with no
 * answer ever is the strip empty, and the app draws nothing for that.
 *
 * `GITHUB_TOKEN` raises the rate limit and is never required: a self-hosted
 * instance without one still works, it simply asks less often.
 */
export async function readContributors(
  db: Db,
  options: { token?: string | undefined; fetchImpl?: typeof fetch; now?: Date } = {},
): Promise<ContributorsView> {
  const now = options.now ?? new Date()
  const isFresh = (fetchedAt: Date) => now.getTime() - fetchedAt.getTime() < CONTRIBUTORS_TTL_MS

  if (memory && isFresh(memory.fetchedAt)) return memory.view

  const cache = db.collection<CachedContributors>(COLLECTIONS.githubContributors)
  const stored = await cache.findOne({ _id: CONTRIBUTORS_REPO })
  if (stored && isFresh(stored.fetchedAt)) {
    memory = stored
    return stored.view
  }

  const view = await fetchFromGitHub(options.token, options.fetchImpl ?? fetch)
  if (view) {
    const entry: CachedContributors = { _id: CONTRIBUTORS_REPO, fetchedAt: now, view }
    await cache.replaceOne({ _id: CONTRIBUTORS_REPO }, entry, { upsert: true })
    memory = entry
    return view
  }
  // Stale beats empty: yesterday's list is still the list of people who built this.
  return stored?.view ?? memory?.view ?? EMPTY
}

/** `null` on any failure — a refusal, a network error, an unexpected body. */
async function fetchFromGitHub(
  token: string | undefined,
  fetchImpl: typeof fetch,
): Promise<ContributorsView | null> {
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'user-agent': 'langx-api',
  }
  if (token) headers.authorization = `Bearer ${token}`

  const people: Contributor[] = []
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const response = await fetchImpl(
        `https://api.github.com/repos/${CONTRIBUTORS_REPO}/contributors?per_page=100&page=${page}`,
        { headers },
      )
      if (!response.ok) return null
      const body: unknown = await response.json()
      if (!Array.isArray(body)) return null
      const rows: unknown[] = body
      for (const row of rows) {
        const person = asContributor(row)
        if (person) people.push(person)
      }
      if (rows.length < 100) break
    }
  } catch {
    return null
  }
  // GitHub already orders by contribution count, most first.
  return { total: people.length, top: people.slice(0, CONTRIBUTORS_TOP) }
}
