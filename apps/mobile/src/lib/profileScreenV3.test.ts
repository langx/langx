import { readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { en } from '../i18n/messages/en'
import { uses as shared } from './v3ScreenParity'

/**
 * Somebody's profile has a second drawing under `flags.v3Home`, in its own
 * file, and the promise is the Settings pages' one (`settingsScreensV3.test.ts`,
 * whose reader this is): only the drawing differs. Every message key, every
 * API path, every call that does something and every accessibility role but
 * `button` the current screen uses must also be used by `ProfileScreenV3` —
 * so a guard before a message, the block confirmation or the report route
 * cannot quietly go missing from one look.
 */
const SCREENS = path.resolve(__dirname, '../screens')

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

describe('the v3 profile keeps the current profile’s words and requests', () => {
  it('ProfileScreenV3.tsx uses everything ProfileScreen.tsx does', () => {
    const before = uses(path.join(SCREENS, 'ProfileScreen.tsx'))
    const after = uses(path.join(SCREENS, 'ProfileScreenV3.tsx'))
    expect(before.keys.size, 'ProfileScreen has no keys — is the reader broken?').toBeGreaterThan(0)
    expect(before.calls.size).toBeGreaterThan(0)
    for (const key of before.keys) expect(after.keys, `key ${key}`).toContain(key)
    for (const api of before.paths) expect(after.paths, `request ${api}`).toContain(api)
    for (const call of before.calls) expect(after.calls, `call ${call}`).toContain(call)
    for (const role of before.roles) {
      if (role !== 'button') expect(after.roles, `role ${role}`).toContain(role)
    }
  })
})

/*
 * The blocks under the profile have twins too: the reviews, the twenty-week
 * map and the week's chart. Each is read with the shared reader, and the
 * reviews twin is held to the same promise as the screen.
 */
const COMPONENTS = path.resolve(__dirname, '../components')
const APP = path.resolve(__dirname, '../../app')
const read = (file: string) => readFileSync(file, 'utf8')

describe('the v3 profile’s blocks keep the current blocks’ words and requests', () => {
  it('ProfileTestimonialsV3 uses everything ProfileTestimonials does', () => {
    const before = shared(path.join(COMPONENTS, 'testimonials/ProfileTestimonials.tsx'))
    const after = shared(path.join(COMPONENTS, 'testimonials/ProfileTestimonialsV3.tsx'))
    // The current "See all ›" carries its own chevron; the v3 pill draws one.
    before.keys.delete('testimonials.seeAll')
    expect(after.keys).toContain('home.seeAll')
    for (const key of before.keys) expect(after.keys, `key ${key}`).toContain(key)
    for (const call of before.calls) expect(after.calls, `call ${call}`).toContain(call)
  })

  it('WeeklyChartV3 says what WeeklyChart says', () => {
    const before = shared(path.join(COMPONENTS, 'WeeklyChart.tsx'))
    const after = shared(path.join(COMPONENTS, 'WeeklyChartV3.tsx'))
    for (const key of before.keys) expect(after.keys, `key ${key}`).toContain(key)
  })

  it('ActivityMapV3 reads the public map the way ActivityMap does', () => {
    const after = shared(path.join(COMPONENTS, 'ActivityMapV3.tsx'))
    for (const call of ['usePublicActivity', 'activityGrid', 'activityCellSize'])
      expect(after.calls, `call ${call}`).toContain(call)
    for (const key of ['activity.weeksAgo', 'day.today'])
      expect(after.keys, `key ${key}`).toContain(key)
  })
})

describe('both ways onto a profile reach the v3 drawing under the flag', () => {
  it('the profile route renders ProfileScreen, which picks by flags.v3Home', () => {
    expect(read(path.join(APP, '(app)/profile/[handle].tsx'))).toMatch(/<ProfileScreen\b/)
    const screen = read(path.join(SCREENS, 'ProfileScreen.tsx'))
    expect(screen).toMatch(
      /useV3Home\(\)\s*\?\s*<ProfileScreenV3 \{\.\.\.props\} \/>\s*:\s*<ProfileScreenCurrent \{\.\.\.props\} \/>/,
    )
  })

  it('"Preview my profile" opens that route from both Me screens', () => {
    for (const file of [
      path.join(APP, '(app)/(tabs)/me.tsx'),
      path.join(SCREENS, 'MeScreenV3.tsx'),
    ]) {
      const source = read(file)
      expect(source, file).toContain("t('me.previewProfile')")
      expect(source, file).toMatch(/openProfile\(profile\.handle,/)
    }
  })

  it('the v3 drawing draws the v3 blocks, and today’s keeps its own', () => {
    const v3 = read(path.join(SCREENS, 'ProfileScreenV3.tsx'))
    for (const block of ['<ProfileTestimonialsV3', '<ActivityMapV3', '<WeeklyChartV3'])
      expect(v3).toContain(block)
    for (const block of ['<ProfileTestimonials\n', '<ActivityMap ', '<WeeklyChart '])
      expect(v3).not.toContain(block)
    // The preview's note and title, on your own page only.
    expect(v3).toContain("t('profile.previewNote')")
    expect(v3).toContain("t('profile.previewTitle')")

    const current = read(path.join(SCREENS, 'ProfileScreen.tsx'))
    for (const block of ['<ProfileTestimonials', '<ActivityMap', '<WeeklyChart'])
      expect(current).toContain(block)
    for (const block of ['ProfileTestimonialsV3', 'ActivityMapV3', 'WeeklyChartV3'])
      expect(current).not.toContain(block)
  })
})
