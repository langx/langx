import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * Nothing in the app may import `react-native` dynamically.
 *
 * A lazy import of an *expo* module is a normal thing to do here and half of
 * `src/lib` does it — a module that reaches the platform is a module the mobile
 * vitest setup cannot load, so the import moves inside the function. Doing the
 * same to `react-native` looks identical and is not: Metro compiles a dynamic
 * import into `importAll`, which builds the namespace object by reading **every**
 * named export off the barrel. Several of those exist only to throw —
 * `PushNotificationIOS` was extracted from core and its getter now blows up — so
 * the promise rejects on a device while resolving perfectly in a browser, where
 * the barrel is react-native-web's and has no such getter.
 *
 * That is not a hypothetical. `readLocationGuideStatus` did exactly this, and
 * the rejection left the location guide screen at its `status === null` branch:
 * a header and nothing else, forever, on both phones and nowhere on the web. In
 * production the unhandled rejection took the app down instead.
 *
 * Nothing else catches it. Types are fine, lint is fine, every test passes, and
 * the web build — the one thing a laptop can run — behaves. Hence a test that
 * reads the source, in the manner of `routeLiterals.test.ts`, and over the AST
 * rather than the text so that this very paragraph does not fail it.
 *
 * The fix is always the same: import `Platform` (or whatever it is) statically
 * at the top of a file the tests do not load, and pass the value in.
 */
const MOBILE = path.join(__dirname, '..', '..')
const ROOTS = ['src', 'app'].map((dir) => path.join(MOBILE, dir))

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(full)
    return /\.tsx?$/.test(entry.name) ? [full] : []
  })
}

function importsReactNativeDynamically(file: string): boolean {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )

  let found = false
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const specifier = node.arguments[0]
      if (specifier && ts.isStringLiteral(specifier) && specifier.text === 'react-native') {
        found = true
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

describe('dynamic imports of react-native', () => {
  it('appear nowhere in the app', () => {
    const offenders = ROOTS.flatMap(sourceFiles)
      .filter(importsReactNativeDynamically)
      .map((file) => path.relative(MOBILE, file))

    expect(offenders).toEqual([])
  })
})
