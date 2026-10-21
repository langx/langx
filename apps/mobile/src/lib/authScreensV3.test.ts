import { readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { en } from '../i18n/messages/en'

/**
 * The sign-in screens each have a second drawing under `flags.v3Home`, and
 * the promise is that only the drawing differs. Here that promise is mostly
 * kept by construction: the route keeps every request, the captcha, the
 * consent state and the rule for when a form may be sent, and hands them to
 * a view in `src/components/auth/` that only draws. What this test holds is
 * the rest — that the view says every word the current drawing says (the
 * age line, the consent sentence and its links, each refusal), goes
 * everywhere it goes, keeps every role but `button`, and draws the same
 * provider block with the same arguments.
 *
 * Read over the AST, as `settingsScreensV3.test.ts` reads Settings, so a
 * comment that names a key does not count.
 */
const APP = path.resolve(__dirname, '../../app')
const VIEWS = path.resolve(__dirname, '../components/auth')

interface Pair {
  route: string
  view: string
  /**
   * Keys and routes only the route's own handlers use — a refusal chosen
   * after the request, the screen a successful sign-up replaces itself with.
   * Both looks run the same handler, so they cannot drift.
   */
  handlerOnly?: readonly string[]
}

const PAIRS: readonly Pair[] = [
  { route: '(auth)/sign-in.tsx', view: 'SignInV3.tsx' },
  {
    route: '(auth)/sign-up.tsx',
    view: 'SignUpV3.tsx',
    handlerOnly: ['errors.signUpFailed', 'common.offline', '/(auth)/check-email'],
  },
  {
    route: '(auth)/sign-in-link.tsx',
    view: 'SignInLinkV3.tsx',
    handlerOnly: ['errors.signInFailed'],
  },
  { route: '(auth)/check-email.tsx', view: 'CheckEmailV3.tsx' },
  {
    route: '(auth)/forgot-password.tsx',
    view: 'ForgotPasswordV3.tsx',
    handlerOnly: ['errors.captchaFailed'],
  },
  {
    route: '(auth)/reset-password.tsx',
    view: 'ResetPasswordV3.tsx',
    handlerOnly: ['errors.resetFailed', '/(auth)/sign-in'],
  },
  { route: '(auth)/verify-email-success.tsx', view: 'VerifyEmailSuccessV3.tsx' },
  { route: '(auth)/qr.tsx', view: 'QrSignInV3.tsx' },
  // The root screens a mailed link, a shared link or a suspension opens.
  { route: 'magic-link.tsx', view: 'MagicLinkV3.tsx', handlerOnly: ['errors.invalidToken', '/'] },
  {
    route: 'verify-email.tsx',
    view: 'VerifyEmailV3.tsx',
    handlerOnly: ['errors.invalidToken', '/'],
  },
  // `/` is where a lifted suspension goes, from the check both looks share.
  {
    route: 'suspended.tsx',
    view: 'SuspendedV3.tsx',
    handlerOnly: ['suspended.alreadyAppealed', 'suspended.failed', '/'],
  },
  { route: '[username].tsx', view: '../SharedProfileV3.tsx' },
]

/** Components whose presence, and whose arguments, are behaviour rather than drawing. */
const BEHAVIOUR_ELEMENTS = new Set(['SocialAuthButtons'])

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
  routes: Set<string>
  roles: Set<string>
  /** `SocialAuthButtons` → the names of the props it is given. */
  elements: Map<string, Set<string>>
  identifiers: Set<string>
}

function uses(file: string): Uses {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const found: Uses = {
    keys: new Set(),
    routes: new Set(),
    roles: new Set(),
    elements: new Map(),
    identifiers: new Set(),
  }
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node)) found.identifiers.add(node.text)
    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const name = node.tagName.getText(source)
      if (BEHAVIOUR_ELEMENTS.has(name)) {
        const props = found.elements.get(name) ?? new Set<string>()
        for (const attribute of node.attributes.properties) {
          // `look` is the one argument that is drawing.
          if (ts.isJsxAttribute(attribute) && attribute.name.getText(source) !== 'look') {
            const value = attribute.initializer
            props.add(
              `${attribute.name.getText(source)}=${value && ts.isStringLiteral(value) ? value.text : '{…}'}`,
            )
          }
        }
        found.elements.set(name, props)
      }
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const text = node.text
      const parent = node.parent
      if (ts.isJsxAttribute(parent) && parent.name.getText(source) === 'accessibilityRole') {
        found.roles.add(text)
      } else if (isMessageKey(text)) {
        found.keys.add(text)
      } else if (text === '/' || text.startsWith('/(')) {
        found.routes.add(text)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

describe('v3 sign-in and link screens keep the current screens’ words, doors and requests', () => {
  for (const { route, view, handlerOnly = [] } of PAIRS) {
    it(`${view} draws everything ${route} does`, () => {
      const before = uses(path.join(APP, route))
      const after = uses(path.join(VIEWS, view))
      const exempt = new Set(handlerOnly)
      expect(before.keys.size, `${route} has no keys — is the reader broken?`).toBeGreaterThan(0)
      for (const key of before.keys) {
        if (!exempt.has(key)) expect(after.keys, `key ${key}`).toContain(key)
      }
      for (const href of before.routes) {
        if (!exempt.has(href)) expect(after.routes, `route ${href}`).toContain(href)
      }
      // `button` is left out: every control in the kit is one.
      for (const role of before.roles) {
        if (role !== 'button') expect(after.roles, `role ${role}`).toContain(role)
      }
      for (const [element, props] of before.elements) {
        expect(after.elements.has(element), `${element} is drawn`).toBe(true)
        for (const prop of props)
          expect(after.elements.get(element), `${element} ${prop}`).toContain(prop)
      }
      // Only drawing: no request, no captcha and no analytics of its own.
      for (const forbidden of [
        'authClient',
        'useCaptcha',
        'track',
        'recordSignupSubmitted',
        'useSubmitAppeal',
        'useSuspension',
        'useQuery',
        'api',
        'writeFlag',
        'writePendingMessageIntent',
      ]) {
        expect(after.identifiers.has(forbidden), `${view} calls ${forbidden}`).toBe(false)
      }
      // Every handled-only exemption must still be in the route, or it is a stale excuse.
      for (const name of handlerOnly) {
        expect(new Set([...before.keys, ...before.routes]), `exemption ${name}`).toContain(name)
      }
    })
  }

  it('starts the consent box unticked, in both looks — one state, set only by a tap', () => {
    const route = readFileSync(path.join(APP, '(auth)/sign-up.tsx'), 'utf8')
    expect(route).toMatch(/const \[accepted, setAccepted\] = useState\(false\)/)
    const after = uses(path.join(VIEWS, 'SignUpV3.tsx'))
    expect(after.roles).toContain('checkbox')
  })
})
