import { readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { en } from '../i18n/messages/en'

/**
 * The Echo pages each have a second drawing under `flags.v3Home`, in its own
 * file, and the promise is that only the drawing differs: the words, the
 * screen-reader roles, the requests and every call that does something are
 * today's. Two copies of a page are two places for one to drift — and these
 * pages schedule reviews and spend daily ceilings — so this holds each v3
 * copy to the current one, the way `settingsScreensV3.test.ts` holds the
 * Settings pages.
 *
 * Read over the AST, so a comment that names a key does not count. The v3
 * side is the page and the dumb parts it draws with, since a pill that moved
 * into a part still says the same words. It may add, but not drop — except
 * the few words listed in `DROPPED`, each with the reason the drawing has no
 * place for it.
 */
const MOBILE = path.resolve(__dirname, '../..')

interface Pair {
  current: string
  v3: readonly string[]
  /** Keys the current page says that the v3 one leaves out, and why. */
  dropped?: Readonly<Record<string, string>>
}

const PAIRS: readonly Pair[] = [
  {
    current: 'app/(app)/echo/cards.tsx',
    v3: ['src/screens/echo/EchoCardsScreenV3.tsx', 'src/components/echo/EchoCardsV3Parts.tsx'],
    dropped: {
      // `EmptyStateV3` is one line and one button: the drawing's empty list
      // says "No cards yet" over New card, and "Nothing matches" over Clear.
      'echo.cardsEmptyBody': 'one-line empty state',
      'echo.searchNoneBody': 'one-line empty state',
    },
  },
  {
    current: 'app/(app)/echo/card/[id].tsx',
    v3: ['src/screens/echo/EchoCardScreenV3.tsx', 'src/components/echo/EchoCardsV3Parts.tsx'],
  },
  { current: 'app/(app)/echo/edit.tsx', v3: ['src/screens/echo/EchoEditScreenV3.tsx'] },
  { current: 'app/(app)/echo/new.tsx', v3: ['src/screens/echo/EchoNewScreenV3.tsx'] },
  {
    current: 'app/(app)/echo/packs.tsx',
    v3: ['src/screens/echo/EchoPacksScreenV3.tsx'],
    // One line over Add a language: the body says what to do, the title only that there are none.
    dropped: { 'echo.packsEmptyTitle': 'one-line empty state' },
  },
  { current: 'app/(app)/echo/pack/[id].tsx', v3: ['src/screens/echo/EchoPackScreenV3.tsx'] },
  {
    current: 'app/(app)/echo/leaderboard.tsx',
    v3: ['src/screens/echo/EchoLeaderboardScreenV3.tsx'],
  },
  // The chat's phrase and quiz pages: the same promise, from the thread's side.
  {
    current: 'app/(app)/all-phrases.tsx',
    v3: ['src/screens/phrases/AllPhrasesScreenV3.tsx', 'src/screens/phrases/PhrasesV3Parts.tsx'],
  },
  {
    current: 'app/(app)/phrases.tsx',
    v3: ['src/screens/phrases/PhrasesScreenV3.tsx', 'src/screens/phrases/PhrasesV3Parts.tsx'],
  },
  { current: 'app/(app)/phrase-card.tsx', v3: ['src/screens/phrases/PhraseCardScreenV3.tsx'] },
  { current: 'app/(app)/quiz.tsx', v3: ['src/screens/phrases/QuizScreenV3.tsx'] },
]

/**
 * Calls about drawing, not doing: each page's own state and styles, the
 * route's flag switch, and the route's id, which the v3 page is handed as a
 * prop rather than reading it again.
 */
const DRAWING_CALLS = new Set([
  'useStyles',
  'useTheme',
  'useState',
  'useCallback',
  'useEffect',
  'useMemo',
  'useRef',
  'makeStyles',
  'useV3Home',
  'useV3HomeDecision',
  'useLocalSearchParams',
  'useLocale',
  'useT',
  't',
])

function isMessageKey(value: string): boolean {
  let node: unknown = en
  for (const part of value.split('.')) {
    if (typeof node !== 'object' || node === null || !(part in node)) return false
    node = (node as Record<string, unknown>)[part]
  }
  return node !== undefined && value.includes('.')
}

interface Uses {
  keys: Set<string>
  paths: Set<string>
  roles: Set<string>
  calls: Set<string>
}

function calleeName(expression: ts.Expression, source: ts.SourceFile): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text
  if (ts.isPropertyAccessExpression(expression)) {
    const target = expression.expression
    if (ts.isIdentifier(target)) return `${target.text}.${expression.name.text}`
    return expression.name.getText(source)
  }
  return undefined
}

function uses(files: readonly string[]): Uses {
  const found: Uses = { keys: new Set(), paths: new Set(), roles: new Set(), calls: new Set() }
  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      readFileSync(path.join(MOBILE, file), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    )
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const name = calleeName(node.expression, source)
        if (name && !DRAWING_CALLS.has(name)) found.calls.add(name)
      }
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        const text = node.text
        const parent = node.parent
        if (ts.isJsxAttribute(parent) && parent.name.getText(source) === 'accessibilityRole') {
          found.roles.add(text)
        } else if (isMessageKey(text)) {
          found.keys.add(text)
        } else if (/^\/[a-z(]/.test(text)) {
          found.paths.add(text)
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return found
}

describe('v3 Echo pages keep the current pages’ words, roles and requests', () => {
  for (const { current, v3, dropped = {} } of PAIRS) {
    it(`${v3[0]} does everything ${current} does`, () => {
      const before = uses([current])
      const after = uses(v3)
      expect(before.keys.size, `${current} has no keys — is the reader broken?`).toBeGreaterThan(0)
      for (const key of before.keys) {
        if (key in dropped) continue
        expect(after.keys, `key ${key}`).toContain(key)
      }
      for (const route of before.paths) expect(after.paths, `path ${route}`).toContain(route)
      for (const call of before.calls) expect(after.calls, `call ${call}`).toContain(call)
      // `button` is left out: every control in the kit is one, and a v3 page
      // that draws `Button` or `IconButton` names no role itself.
      for (const role of before.roles) {
        if (role !== 'button') expect(after.roles, `role ${role}`).toContain(role)
      }
    })

    // A drop that is no longer one — the v3 page says it after all — is a
    // stale line here, and the list is only worth reading while it is true.
    it(`${v3[0]} really leaves out what it says it does`, () => {
      const after = uses(v3)
      for (const key of Object.keys(dropped)) expect(after.keys, `key ${key}`).not.toContain(key)
    })
  }
})
