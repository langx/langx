import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * Every Better Auth call the API puts behind Turnstile (`CAPTCHA_ENDPOINTS` in
 * `apps/api/src/auth/captcha.ts`) has to carry the token, or the screen that
 * makes it stops working the day `flags.captchaRequired` is turned on — and
 * nothing before that day would show it. So: every such call anywhere under
 * `app/` passes `captcha.fetchOptions` in its `fetchOptions`, and every file
 * that makes one draws `captcha.widget`.
 *
 * Read over the AST, as `authScreensV3.test.ts` reads the auth screens, so a
 * comment that names the call does not count.
 */
const APP = path.resolve(__dirname, '../../app')

/** `authClient.…` for each covered endpoint, in the API list's order. */
const CAPTCHA_CALLS = [
  'signUp.email',
  'signIn.email',
  'requestPasswordReset',
  'signIn.magicLink',
  'sendVerificationEmail',
]

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : []
  })
}

interface Call {
  file: string
  method: string
  /** The text of the `fetchOptions` property's value, or null without one. */
  fetchOptions: string | null
}

function captchaCalls(file: string): { calls: Call[]; drawsWidget: boolean } {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const calls: Call[] = []
  let drawsWidget = false
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAccessExpression(node) && node.getText(source) === 'captcha.widget') {
      drawsWidget = true
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(source)
      const method = CAPTCHA_CALLS.find((name) => callee === `authClient.${name}`)
      if (method) {
        const [options] = node.arguments
        const property =
          options && ts.isObjectLiteralExpression(options)
            ? options.properties.find(
                (p): p is ts.PropertyAssignment =>
                  ts.isPropertyAssignment(p) && p.name.getText(source) === 'fetchOptions',
              )
            : undefined
        calls.push({
          file: path.relative(APP, file),
          method,
          fetchOptions: property ? property.initializer.getText(source) : null,
        })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return { calls, drawsWidget }
}

const scanned = sourceFiles(APP).map((file) => ({ file, ...captchaCalls(file) }))
const allCalls = scanned.flatMap((entry) => entry.calls)

describe('screens that call a captcha-covered auth endpoint', () => {
  it('finds a caller for every covered endpoint', () => {
    expect(new Set(allCalls.map((call) => call.method))).toEqual(new Set(CAPTCHA_CALLS))
  })

  it.each(allCalls.map((call) => [`${call.file}: ${call.method}`, call] as const))(
    '%s sends the token',
    (_, call) => {
      expect(call.fetchOptions ?? '').toMatch(/\bcaptcha\.fetchOptions\b/)
    },
  )

  it.each(
    scanned
      .filter((entry) => entry.calls.length > 0)
      .map((entry) => [path.relative(APP, entry.file), entry] as const),
  )('%s draws the widget', (_, entry) => {
    expect(entry.drawsWidget).toBe(true)
  })
})
