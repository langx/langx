import { readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { en } from '../i18n/messages/en'

/**
 * The posts and people pages each have a second drawing under
 * `flags.v3Home`, and the promise is the one `settingsScreensV3.test.ts`
 * holds the Settings pages to: only the drawing differs. Every message key,
 * API path, call that does something and accessibility role the current page
 * uses must also be used by its v3 twin — read over the AST, so a comment
 * that names a key does not count. The v3 file may add, never drop.
 *
 * `PostScreen` and `filters.tsx` are not pairs: each keeps one component
 * and swaps its style sheet by the flag, so its behaviour cannot drift. What
 * can drift is the sheet, and the last tests hold each pair of sheets to the
 * same names.
 */
const MOBILE = path.resolve(__dirname, '../..')

const PAIRS: readonly { current: string; v3: string }[] = [
  { current: 'app/(app)/compose.tsx', v3: 'src/screens/posts/ComposeScreenV3.tsx' },
  {
    current: 'app/(app)/post-corrections.tsx',
    v3: 'src/screens/posts/PostCorrectionsScreenV3.tsx',
  },
  { current: 'app/(app)/likes.tsx', v3: 'src/screens/people/LikesScreenV3.tsx' },
  { current: 'app/(app)/follows.tsx', v3: 'src/screens/people/FollowsScreenV3.tsx' },
  { current: 'app/(app)/viewers.tsx', v3: 'src/screens/people/ViewersScreenV3.tsx' },
  {
    current: 'app/(app)/notifications.tsx',
    v3: 'src/screens/people/NotificationsScreenV3.tsx',
  },
  { current: 'app/(app)/report.tsx', v3: 'src/screens/people/ReportScreenV3.tsx' },
  { current: 'app/(app)/scan.tsx', v3: 'src/screens/people/ScanScreenV3.tsx' },
]

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

/** About drawing, not doing — see `settingsScreensV3.test.ts`. */
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
  'useLocale',
  'useT',
  't',
  // The placeholder rows, which the kit's skeleton block draws for itself.
  'SKELETON_ROWS.map',
])

function calleeName(expression: ts.Expression, source: ts.SourceFile): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text
  if (ts.isPropertyAccessExpression(expression)) {
    const target = expression.expression
    if (ts.isIdentifier(target)) return `${target.text}.${expression.name.text}`
    return expression.name.getText(source)
  }
  return undefined
}

/**
 * The current page's own component, without the route's switch: the route
 * file holds both the switch and today's page, and the switch names the v3
 * component, which its twin does not call.
 */
function sourceOf(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    readFileSync(path.join(MOBILE, file), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
}

function uses(file: string): Uses {
  const source = sourceOf(file)
  const found: Uses = { keys: new Set(), paths: new Set(), roles: new Set(), calls: new Set() }
  const visit = (node: ts.Node): void => {
    // The route's switch is not the page.
    if (ts.isFunctionDeclaration(node) && node.name?.text.endsWith('Route')) return
    if (ts.isCallExpression(node)) {
      const name = calleeName(node.expression, source)
      if (name && !DRAWING_CALLS.has(name)) found.calls.add(name)
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const text = node.text
      const parent = node.parent
      const attribute = ts.isJsxAttribute(parent) ? parent.name.getText(source) : undefined
      // A kit row takes its role as `role`; a hand-drawn one as `accessibilityRole`.
      if (attribute === 'accessibilityRole' || attribute === 'role') {
        found.roles.add(text)
      } else if (isMessageKey(text)) {
        found.keys.add(text)
      } else if (/^\/[a-z]/.test(text) && !text.startsWith('/(')) {
        found.paths.add(text)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

describe('v3 posts and people pages keep the current pages’ words and requests', () => {
  for (const { current, v3 } of PAIRS) {
    it(`${path.basename(v3)} uses everything ${current} does`, () => {
      const before = uses(current)
      const after = uses(v3)
      expect(before.keys.size, `${current} has no keys — is the reader broken?`).toBeGreaterThan(0)
      expect(before.calls.size, `${current} calls nothing — is the reader broken?`).toBeGreaterThan(
        3,
      )
      for (const key of before.keys) expect(after.keys, `key ${key}`).toContain(key)
      for (const api of before.paths) expect(after.paths, `request ${api}`).toContain(api)
      for (const call of before.calls) expect(after.calls, `call ${call}`).toContain(call)
      for (const role of before.roles) {
        if (role !== 'button') expect(after.roles, `role ${role}`).toContain(role)
      }
    })
  }
})

/** The names a `makeStyles(() => ({ … }))` sheet defines. */
function sheetKeys(file: string, name: string): Set<string> {
  const source = sourceOf(file)
  const keys = new Set<string>()
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(source) === name &&
      node.initializer &&
      ts.isCallExpression(node.initializer)
    ) {
      const factory = node.initializer.arguments[0]
      if (factory && ts.isArrowFunction(factory)) {
        let body: ts.Node = factory.body
        if (ts.isParenthesizedExpression(body)) body = body.expression
        if (ts.isObjectLiteralExpression(body)) {
          for (const property of body.properties) {
            if (property.name) keys.add(property.name.getText(source))
          }
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return keys
}

describe('the pages that swap sheets', () => {
  const SHEETS = [
    {
      page: 'src/screens/PostScreen.tsx',
      v3: 'src/screens/PostScreenV3.styles.ts',
      name: 'usePostStylesV3',
    },
    {
      page: 'app/(app)/filters.tsx',
      v3: 'src/screens/people/FiltersV3.styles.ts',
      name: 'useFiltersStylesV3',
    },
  ]
  for (const { page, v3, name } of SHEETS) {
    it(`${path.basename(page)}’s two sheets name the same styles`, () => {
      const legacy = sheetKeys(page, 'useStyles')
      const fresh = sheetKeys(v3, name)
      expect(legacy.size).toBeGreaterThan(10)
      expect([...fresh].sort()).toEqual([...legacy].sort())
    })
  }
})

/** A function's or a variable's whole source, whitespace folded. */
function declarationText(file: string, name: string): string | undefined {
  const source = sourceOf(file)
  let found: string | undefined
  const visit = (node: ts.Node): void => {
    if (found) return
    if (
      (ts.isFunctionDeclaration(node) && node.name?.text === name) ||
      (ts.isVariableDeclaration(node) && node.name.getText(source) === name)
    ) {
      found = node.getText(source).replace(/\s+/g, ' ')
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

/*
 * A report feeds moderation: what is sent, where back goes, which question is
 * asked and which toast follows must not differ between the looks by one
 * character, so these are compared as text rather than by what they call.
 */
describe('the v3 report page files today’s report', () => {
  for (const name of ['submit', 'backTo', 'question']) {
    it(`keeps ${name} as it is`, () => {
      const before = declarationText('app/(app)/report.tsx', name)
      expect(before, name).toBeDefined()
      expect(declarationText('src/screens/people/ReportScreenV3.tsx', name)).toBe(before)
    })
  }
})
