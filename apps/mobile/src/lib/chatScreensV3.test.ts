import { readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { en } from '../i18n/messages/en'

/**
 * The chat and messaging pages each have a second drawing under
 * `flags.v3Home`, in its own file under `src/screens/chat/`, and the promise
 * is that only the drawing differs: the words, the screen-reader names, the
 * requests and the safety wording are today's. This holds each v3 copy to
 * the current one, read the way `settingsScreensV3.test.ts` reads the
 * Settings pages — every message key, API path, call that does something and
 * accessibility role but `button` the current screen uses must be used by its
 * twin too. The v3 file may add, not drop.
 *
 * `replaced` is the one escape, and it is spelled out per key: where the
 * board says two of today's lines as one (an empty state's title and body
 * become one sentence), the new key must say the same thing in every locale
 * and the pair is named here, so the swap is a decision and not a drift.
 */
const APP = path.resolve(__dirname, '../../app/(app)')
const SCREENS = path.resolve(__dirname, '../screens/chat')

const PAIRS: readonly {
  current: string
  v3: string
  replaced?: Readonly<Record<string, string>>
}[] = [
  { current: 'starred.tsx', v3: 'StarredScreenV3.tsx' },
  { current: 'corrections.tsx', v3: 'CorrectionsScreenV3.tsx' },
  { current: 'propose-time.tsx', v3: 'ProposeTimeScreenV3.tsx' },
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

/**
 * Calls that are about drawing, not doing: the hooks every page uses for its
 * own state and styles, and the route's flag switch. Everything else the
 * current page calls — a request, a sign-out, a confirmation, an
 * invalidation, a permission prompt — must be called by its twin too, so a
 * handler that drops a step fails here, not on a device.
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
  'useLocale',
  'useT',
  't',
])

/** `api.post(…)` → `api.post`, `confirmAlert(…)` → `confirmAlert`. */
function calleeName(expression: ts.Expression, source: ts.SourceFile): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text
  if (ts.isPropertyAccessExpression(expression)) {
    const target = expression.expression
    if (ts.isIdentifier(target)) return `${target.text}.${expression.name.text}`
    return expression.name.getText(source)
  }
  return undefined
}

function uses(file: string): Uses {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const found: Uses = { keys: new Set(), paths: new Set(), roles: new Set(), calls: new Set() }
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const name = calleeName(node.expression, source)
      if (name && !DRAWING_CALLS.has(name)) found.calls.add(name)
    }
    // The kit's row says `link` for itself when it leaves the app.
    if (ts.isJsxAttribute(node) && node.name.getText(source) === 'external') found.roles.add('link')
    // …and calls `goBackTo` for the page that hands it `back`.
    if (ts.isJsxAttribute(node) && node.name.getText(source) === 'back') found.calls.add('goBackTo')
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const text = node.text
      const parent = node.parent
      if (ts.isJsxAttribute(parent) && parent.name.getText(source) === 'accessibilityRole') {
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

describe('v3 chat pages keep the current pages’ words and requests', () => {
  for (const { current, v3, replaced = {} } of PAIRS) {
    it(`${v3} uses everything ${current} does`, () => {
      const before = uses(path.join(APP, current))
      const after = uses(path.join(SCREENS, v3))
      expect(before.keys.size, `${current} has no keys — is the reader broken?`).toBeGreaterThan(0)
      for (const key of before.keys)
        expect(after.keys, `key ${key}`).toContain(replaced[key] ?? key)
      for (const api of before.paths) expect(after.paths, `request ${api}`).toContain(api)
      for (const call of before.calls) expect(after.calls, `call ${call}`).toContain(call)
      for (const role of before.roles) {
        if (role !== 'button') expect(after.roles, `role ${role}`).toContain(role)
      }
    })
  }
})
