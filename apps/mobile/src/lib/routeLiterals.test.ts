import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * Every route literal in the app resolves to a screen that exists.
 *
 * This exists because **nothing else checks it**. `app.config.ts` sets
 * `experiments.typedRoutes`, which reads as though `router.push('/nope')` is
 * validated, and it is not: the declaration lives in `.expo/types/router.d.ts`,
 * which only a running Expo dev server writes. That file has three states, and
 * the one CI is always in is the dangerous one:
 *
 * - **absent** (CI, and any fresh checkout) — every route string is accepted;
 * - **fresh** — routes are genuinely checked;
 * - **stale** — a route that is correct is *rejected*, because the file is
 *   frozen at whatever screens existed when it was written.
 *
 * So a genuinely wrong route literal merges green and fails silently at
 * runtime. `expo export` does not generate the file either, so there is no
 * "just run the export in CI" shortcut.
 *
 * ## What this test covers, exactly
 *
 * Stated plainly, because a test like this is easy to remember as "routes are
 * verified" when it is narrower than that:
 *
 * - Route files are read from the `app/` tree on disk, never listed here — so
 *   adding a screen updates this test by itself. A hard-coded list would go
 *   stale the first time someone added a screen, which is the exact failure
 *   `router.d.ts` has.
 * - Group segments (`(app)`) are treated as **optional**, since expo-router
 *   accepts a path with or without them.
 * - `[param]` matches exactly one segment; `[...rest]` matches one or more.
 * - `index.tsx` collapses to its parent directory; `_layout.tsx` and
 *   `+`-prefixed files (`+not-found`, `+html`) are not routes.
 * - An interpolated value in a template literal is treated as a wildcard: the
 *   *shape* of the path is checked, not the value.
 * - Query strings and hashes are stripped before matching.
 *
 * ## How the literals are found, and what that misses
 *
 * Finding them is the fragile half — matching them is easy. Two nets run, and
 * everything either one catches is validated:
 *
 * - **By call shape**: the arguments of `router.push` and the handful of
 *   helpers in `ROUTE_CALLEES`, plus `href` and `pathname`. This is the only
 *   net that can see a *groupless* route, so it is the only one that catches
 *   `router.push('/starrred')`.
 * - **By shape of the string**: any literal beginning with `/(`, wherever it
 *   sits — a return value, a ternary, an argument to `encodeURIComponent`.
 *   This is what keeps the test honest when someone adds a navigation helper
 *   nobody listed above: their route still gets checked.
 *
 * **The gap the two leave:** a *misspelled groupless* route passed through a
 * call shape not in `ROUTE_CALLEES` — `navigateTo('/starrred')` — is caught by
 * neither, because a groupless string is indistinguishable from an API path
 * (`/me/activity`) without knowing the callee. Adding the helper to
 * `ROUTE_CALLEES` closes it. Nothing here detects that it needs adding.
 *
 * **Also not covered:** whether a route is reachable given the auth guards,
 * whether a param value is valid, and anything built by concatenation rather
 * than written as one literal. It mimics the router; it is not the router. If
 * the two ever disagree, this test is the one that is wrong.
 *
 * It lives under `src/lib` because that is where `vitest.config.ts` looks —
 * not because it is a helper.
 */

const APP_DIR = 'app'
const SEARCH_DIRS = ['app', 'src']

/**
 * The call shapes the structured scan understands.
 *
 * Kept here, in the test, because the whole risk is that a new one appears and
 * is missed silently — which the last case in this file is what guards.
 */
const ROUTE_CALLEES = new Set([
  'router.push',
  'router.replace',
  'router.navigate',
  'router.prefetch',
  'goBackTo',
  'openPaywall',
  'openProfile',
  'openPost',
])
const ROUTE_ATTRIBUTES = new Set(['href'])
const ROUTE_PROPERTIES = new Set(['pathname'])

/** Stands in for an interpolated value; deliberately not a valid path segment. */
const WILDCARD = ' wild'

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      walk(full, out)
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.includes('.test.')) {
      out.push(full)
    }
  }
  return out
}

/**
 * Every path expo-router will serve, as segment arrays. A route with one group
 * yields two forms — `(app)/me` and `me` — because both are accepted.
 */
function routePatterns(): string[][] {
  const patterns: string[][] = []
  for (const file of walk(APP_DIR)) {
    const name = path.basename(file)
    if (name === '_layout.tsx' || name.startsWith('+')) continue

    let rel = file.slice(APP_DIR.length + 1).replace(/\.tsx?$/, '')
    if (rel === 'index') rel = ''
    else rel = rel.replace(/\/index$/, '')

    const segments = rel.split('/').filter(Boolean)
    const groups = segments.filter((segment) => segment.startsWith('(')).length
    // Each group segment is independently present or absent.
    for (let mask = 0; mask < 1 << groups; mask++) {
      let seen = 0
      const variant = segments.filter((segment) => {
        if (!segment.startsWith('(')) return true
        return (mask & (1 << seen++)) !== 0
      })
      patterns.push(variant)
    }
  }
  return patterns
}

/**
 * One segment against one pattern segment.
 *
 * Either side can be a wildcard, and they mean different things: `[id]` in the
 * pattern is a parameter the router will fill, while `WILDCARD` in the literal
 * is a value the source interpolates and this test cannot know. Both match
 * anything, so `/(onboarding)/${step}` resolves against every screen in the
 * group rather than none of them.
 */
function segmentMatches(pattern: string, segment: string | undefined): boolean {
  if (segment === undefined) return false
  return pattern.startsWith('[') || segment === WILDCARD || pattern === segment
}

function matches(literal: string, patterns: string[][]): boolean {
  const clean = literal.split('?')[0]!.split('#')[0]!
  const segments = clean.split('/').filter(Boolean)

  // A trailing slash means the string is the *start* of a path rather than a
  // whole one — `backHref.ts` tests inbound values with `startsWith('/(app)/')`.
  //
  // This is not an exemption, and must not become one: the prefix still has to
  // be the prefix of a route that exists, so `'/(app)/chatt/'` fails exactly
  // like `'/(app)/chatt'` would. Anything built by concatenating onto such a
  // base is therefore checked as far as the base goes — which is as far as a
  // literal can be checked at all.
  if (clean.endsWith('/') && segments.length > 0) {
    return patterns.some(
      (pattern) =>
        pattern.length > segments.length &&
        segments.every((segment, i) => segmentMatches(pattern[i]!, segment)),
    )
  }

  return patterns.some((pattern) => {
    const rest = pattern.findIndex((segment) => segment.startsWith('[...'))
    if (rest >= 0) {
      // A catch-all swallows the tail: match the prefix, and require at least
      // one segment for it to swallow.
      if (segments.length <= rest) return false
      return pattern.slice(0, rest).every((segment, i) => segmentMatches(segment, segments[i]))
    }
    if (pattern.length !== segments.length) return false
    return pattern.every((segment, i) => segmentMatches(segment, segments[i]))
  })
}

interface Found {
  file: string
  line: number
  literal: string
}

/** A string or template literal, with interpolations collapsed to a wildcard. */
function literalOf(node: ts.Node): string | null {
  if (ts.isStringLiteral(node)) return node.text
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isTemplateExpression(node)) {
    return node.head.text + node.templateSpans.map((span) => WILDCARD + span.literal.text).join('')
  }
  return null
}

function scan(): { structured: Found[]; broad: Found[] } {
  const structured: Found[] = []
  const broad: Found[] = []

  for (const dir of SEARCH_DIRS) {
    for (const file of walk(dir)) {
      const src = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      )
      const record = (into: Found[], node: ts.Node, literal: string): void => {
        const { line } = src.getLineAndCharacterOfPosition(node.getStart(src))
        into.push({ file, line: line + 1, literal })
      }

      const visit = (node: ts.Node): void => {
        // Structured: the call shapes listed above.
        if (ts.isCallExpression(node) && ROUTE_CALLEES.has(node.expression.getText(src))) {
          for (const arg of node.arguments) {
            const literal = literalOf(arg)
            if (literal?.startsWith('/')) record(structured, arg, literal)
          }
        }
        if (ts.isJsxAttribute(node) && ROUTE_ATTRIBUTES.has(node.name.getText(src))) {
          const value = node.initializer
          const inner =
            value && ts.isJsxExpression(value) && value.expression ? value.expression : value
          const literal = inner ? literalOf(inner) : null
          if (inner && literal?.startsWith('/')) record(structured, inner, literal)
        }
        if (ts.isPropertyAssignment(node) && ROUTE_PROPERTIES.has(node.name.getText(src))) {
          const literal = literalOf(node.initializer)
          if (literal?.startsWith('/')) record(structured, node.initializer, literal)
        }

        // Broad net: anything shaped like a grouped route, wherever it sits.
        // `/(` is unmistakable — an API path (`/conversations/...`) never has it.
        const any = literalOf(node)
        if (any?.startsWith('/(')) record(broad, node, any)

        ts.forEachChild(node, visit)
      }
      visit(src)
    }
  }
  return { structured, broad }
}

const patterns = routePatterns()
const { structured, broad } = scan()

/**
 * Everything either net found, deduplicated by position. Validating the union
 * rather than only the structured half is what lets a route written through an
 * unlisted helper still be checked.
 */
const all = [...structured, ...broad].filter(
  (found, index, list) =>
    list.findIndex(
      (other) =>
        other.file === found.file && other.line === found.line && other.literal === found.literal,
    ) === index,
)

/** For a failure message: the wildcard back as something readable. */
function show(found: Found): string {
  return `${found.file}:${found.line} -> ${found.literal.replaceAll(WILDCARD, '${}')}`
}

describe('matching', () => {
  // Pinned because the trailing-slash branch is the one rule here that could be
  // "simplified" into a real exemption by someone who read it as one.
  const patterns = [
    ['(app)', 'chat', '[id]'],
    ['(app)', 'me'],
  ]

  it('accepts a prefix of a route that exists', () => {
    expect(matches('/(app)/chat/', patterns)).toBe(true)
  })

  it('still rejects a prefix of a route that does not', () => {
    expect(matches('/(app)/chatt/', patterns)).toBe(false)
  })

  it('fills a param with an interpolated value, and a literal with itself', () => {
    expect(matches(`/(app)/chat/${WILDCARD}`, patterns)).toBe(true)
    expect(matches('/(app)/chat/abc', patterns)).toBe(true)
    expect(matches('/(app)/chat', patterns)).toBe(false)
  })

  it('strips a query before matching', () => {
    expect(matches('/(app)/me?from=x', patterns)).toBe(true)
  })
})

describe('route literals', () => {
  it('finds the screens on disk', () => {
    // A sanity floor: if the walk breaks, every case below passes vacuously.
    expect(patterns.length).toBeGreaterThan(20)
  })

  it('finds route literals to check, by both nets', () => {
    // The same guard from the other side. A scan that silently matched nothing
    // would report "all routes valid" while checking none — which is the shape
    // of failure this whole test exists to prevent. The floors are set below
    // today's counts, loosely enough that deleting one screen is not a
    // failure and tightly enough that a broken walk is.
    expect(structured.length).toBeGreaterThan(40)
    expect(broad.length).toBeGreaterThan(60)
  })

  it('resolves every one of them to a screen', () => {
    expect(all.filter((found) => !matches(found.literal, patterns)).map(show)).toEqual([])
  })
})
