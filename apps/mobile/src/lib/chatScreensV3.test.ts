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
 * `via` is the one escape, spelled out per key: a word the current page
 * writes itself and its twin reaches through a v3 kit component it draws —
 * the thread's band names the partner `chat.title` until their profile
 * arrives. The test then reads that component for the key and the v3 page
 * for the component, so the word still cannot go missing unnoticed.
 */
const APP = path.resolve(__dirname, '../../app/(app)')
const SCREENS = path.resolve(__dirname, '../screens/chat')
const SRC = path.resolve(__dirname, '..')

const PAIRS: readonly {
  current: string
  v3: string
  /** Key → the kit file under `src/` that says it for the v3 page. */
  via?: Readonly<Record<string, string>>
}[] = [
  { current: 'starred.tsx', v3: 'StarredScreenV3.tsx' },
  { current: 'corrections.tsx', v3: 'CorrectionsScreenV3.tsx' },
  { current: 'propose-time.tsx', v3: 'ProposeTimeScreenV3.tsx' },
  {
    current: 'chat/new.tsx',
    v3: 'NewChatScreenV3.tsx',
    via: { 'chat.title': 'components/thread/ThreadHeaderV3.tsx' },
  },
  { current: 'chat-media.tsx', v3: 'ChatMediaScreenV3.tsx' },
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
    // A header handed `onBack` draws the back button, named `common.backPlain`.
    if (ts.isJsxAttribute(node) && node.name.getText(source) === 'onBack') {
      found.keys.add('common.backPlain')
    }
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

/**
 * The two pages whose v3 look is one step drawn again rather than a whole
 * page: the route keeps every handler and hands them over, so only the words
 * of that step are checked — the three ways a snap is sent, Retake and Send.
 * View once adds a drawing and takes nothing away, so it has no entry.
 */
const PARTS: readonly { v3: string; keys: readonly string[] }[] = [
  {
    v3: 'SnapPreviewV3.tsx',
    keys: [
      'viewOnce.modeOnce',
      'viewOnce.modeReplay',
      'viewOnce.modeKeep',
      'viewOnce.retake',
      'viewOnce.send',
    ],
  },
]

describe('v3 chat steps keep the current step’s words', () => {
  for (const { v3, keys } of PARTS) {
    it(`${v3} says what the current step says`, () => {
      const found = uses(path.join(SCREENS, v3))
      for (const key of keys) expect(found.keys, `key ${key}`).toContain(key)
    })
  }
})

describe('v3 chat pages keep the current pages’ words and requests', () => {
  for (const { current, v3, via = {} } of PAIRS) {
    it(`${v3} uses everything ${current} does`, () => {
      const before = uses(path.join(APP, current))
      const after = uses(path.join(SCREENS, v3))
      const v3Source = readFileSync(path.join(SCREENS, v3), 'utf8')
      expect(before.keys.size, `${current} has no keys — is the reader broken?`).toBeGreaterThan(0)
      for (const key of before.keys) {
        const kit = via[key]
        if (kit) {
          expect(uses(path.join(SRC, kit)).keys, `key ${key} in ${kit}`).toContain(key)
          expect(v3Source, `${v3} draws ${kit}`).toContain(path.basename(kit, '.tsx'))
        } else {
          expect(after.keys, `key ${key}`).toContain(key)
        }
      }
      for (const api of before.paths) expect(after.paths, `request ${api}`).toContain(api)
      for (const call of before.calls) expect(after.calls, `call ${call}`).toContain(call)
      for (const role of before.roles) {
        if (role !== 'button') expect(after.roles, `role ${role}`).toContain(role)
      }
    })
  }
})
