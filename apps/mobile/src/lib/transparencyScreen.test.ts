import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The Transparency page shows only what `GET /public/stats` publishes.
 *
 * That endpoint is the line `docs/insight.md` draws: whatever is on it is
 * public by being there, and whatever is on `/admin/stats` — revenue, plan
 * mix, conversion — must never be. The two are a few lines apart in
 * `api/queries.ts`, so the page is held here to its own hook
 * (`api/publicStats.ts`) and away from anything of the operator panel's. A
 * lint rule would say the same; a test also says why.
 */

const MOBILE = path.join(__dirname, '../..')
const FILES = [
  'src/screens/TransparencyScreenV3.tsx',
  'src/api/publicStats.ts',
  'app/(app)/transparency.tsx',
]
const read = (file: string) => readFileSync(path.join(MOBILE, file), 'utf8')

/** Every module a file imports, and the names it takes from each. */
function imports(source: string): { from: string; names: string[] }[] {
  return [...source.matchAll(/import\s+(?:type\s+)?([\s\S]*?)\s+from\s+'([^']+)'/g)].map(
    (match) => ({
      from: match[2]!,
      names: (match[1]!.match(/[A-Za-z_$][\w$]*/g) ?? []).filter((name) => name !== 'type'),
    }),
  )
}

describe('the Transparency page', () => {
  it.each(FILES)('%s reaches for nothing of the operator panel’s', (file) => {
    const source = read(file)
    for (const { from, names } of imports(source)) {
      expect(from, file).not.toMatch(/admin/i)
      for (const name of names) expect(name, `${file}: ${from}`).not.toMatch(/admin/i)
    }
    expect(source).not.toMatch(/['"`]\/admin\//)
    expect(source).not.toMatch(/useAdmin/)
  })

  it('takes its numbers from the public hook and nothing else of the API layer', () => {
    const screen = imports(read('src/screens/TransparencyScreenV3.tsx'))
    const api = screen.filter(({ from }) => from.startsWith('../api/'))
    expect(api).toEqual([
      { from: '../api/publicStats', names: ['usePublicStats'] },
      // The viewer's own plan, for the support row's words — not a number on the page.
      { from: '../api/queries', names: ['useIsPro'] },
    ])
  })

  it('sends a rating to the store’s review form, never the rationed in-app sheet', () => {
    const source = read('src/screens/TransparencyScreenV3.tsx')
    const screen = imports(source)
    expect(screen).toContainEqual({ from: '../lib/storeListing', names: ['openStoreReview'] })
    expect(screen.map(({ from }) => from)).not.toContain('../hooks/useReviewPrompt')
    // The web has no store to send anyone to, as Settings › About knows.
    expect(source).toContain("Platform.OS === 'web' ? null : <RateRow />")
  })

  it('asks the public endpoint, and parses the answer with the shared schema', () => {
    const hook = read('src/api/publicStats.ts')
    expect(hook).toContain("'/public/stats'")
    expect(hook).toContain('publicStatsSchema.parse')
    expect(hook).toContain('staleTime: PUBLIC_STATS_TTL_MS')
  })
})
