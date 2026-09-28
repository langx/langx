import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * A screen that navigates itself away must not change its own state in the
 * same tick.
 *
 * `router.replace` and `router.back` take the current screen out of the stack.
 * On Android under Fabric, react-native-screens detaches that screen's views to
 * animate them out, and if the same commit also mutates something inside it —
 * a button swapping its spinner back for its label is enough — the mount step
 * tries to insert a view that already has a parent:
 *
 *     addViewAt: failed to insert view [376] into parent [380] at index 24
 *     The specified child already has a parent.
 *
 * In a debug build that is a red screen. In a release build `ReactHost` treats
 * it as fatal to the instance and tears it down, and what is left is the
 * window's own background: a white page with nothing on it, until the app is
 * killed and opened again. Measured on a Release APK, 27 September 2026, on the
 * two paths a stranger takes first — the welcome-back screen's "Start
 * exploring" and sign-up's "Sign up" — and fixed on both by leaving the busy
 * state alone on the way out. iOS never reproduced it, which is why it shipped.
 *
 * `5f63f04eb` was the same failure one step earlier: a `router.replace('/')`
 * landing in the commit that rebuilt the root navigator.
 *
 * What this reads, over the AST so that comments cannot trip it, is a narrow
 * and mechanical version of the rule: a call to a state setter (`setSomething(`)
 * that runs synchronously with `router.replace(` or `router.back(` —
 *
 * - earlier or later in the same block, with no `await` or `return` between
 *   them (a setter inside a nested `if` is skipped: those are the error
 *   branches that do not navigate), or
 * - in the `finally` of a `try` whose body or `catch` navigates.
 *
 * The fix is always to reset the state only on the path that stays.
 */
const MOBILE = path.join(__dirname, '..', '..')
const ROOTS = ['src', 'app'].map((dir) => path.join(MOBILE, dir))

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(full)
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.ts') ? [full] : []
  })
}

const LEAVES = new Set(['replace', 'back'])

/** `router.replace(...)` / `router.back()`, written directly in this node and not in a nested function. */
function leaves(node: ts.Node): boolean {
  let found = false
  const visit = (child: ts.Node): void => {
    if (found || ts.isFunctionLike(child)) return
    if (
      ts.isCallExpression(child) &&
      ts.isPropertyAccessExpression(child.expression) &&
      ts.isIdentifier(child.expression.expression) &&
      child.expression.expression.text === 'router' &&
      LEAVES.has(child.expression.name.text)
    ) {
      found = true
      return
    }
    ts.forEachChild(child, visit)
  }
  visit(node)
  return found
}

/** A top-level `setSomething(...)` statement. */
function setterName(statement: ts.Statement): string | null {
  if (!ts.isExpressionStatement(statement)) return null
  const call = statement.expression
  if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression)) return null
  return /^set[A-Z]/.test(call.expression.text) ? call.expression.text : null
}

/** Whether a statement ends the synchronous run: an `await` in it, or a `return`. */
function breaksTheTick(statement: ts.Statement): boolean {
  if (ts.isReturnStatement(statement)) return true
  let found = false
  const visit = (child: ts.Node): void => {
    if (found || ts.isFunctionLike(child)) return
    if (ts.isAwaitExpression(child)) {
      found = true
      return
    }
    ts.forEachChild(child, visit)
  }
  visit(statement)
  return found
}

/** Setters at the end of a block that falls through, back to its last await. */
function tailSetters(
  statements: ts.NodeArray<ts.Statement>,
  where: (node: ts.Node, name: string) => void,
): void {
  const last = statements[statements.length - 1]
  if (!last || ts.isReturnStatement(last) || ts.isThrowStatement(last)) return
  for (let i = statements.length - 1; i >= 0; i--) {
    const statement = statements[i]!
    if (breaksTheTick(statement)) break
    const name = setterName(statement)
    if (name) where(statement, name)
  }
}

function offences(file: string): string[] {
  const text = readFileSync(file, 'utf8')
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: string[] = []
  const where = (node: ts.Node, name: string) => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source))
    found.push(`${path.relative(MOBILE, file)}:${line + 1} ${name}`)
  }

  const visit = (node: ts.Node): void => {
    if (ts.isBlock(node) || ts.isSourceFile(node)) {
      const statements = node.statements
      statements.forEach((statement, index) => {
        if (!leaves(statement) || ts.isTryStatement(statement)) return
        // Backwards to the last await, then forwards to the next one.
        for (let i = index - 1; i >= 0; i--) {
          const earlier = statements[i]!
          // An `if` that falls through into the navigation: whatever its
          // block did after its own last await is still in this tick.
          if (ts.isIfStatement(earlier)) {
            for (const branch of [earlier.thenStatement, earlier.elseStatement]) {
              if (branch && ts.isBlock(branch)) tailSetters(branch.statements, where)
            }
          }
          if (breaksTheTick(earlier)) break
          const name = setterName(earlier)
          if (name) where(earlier, name)
        }
        for (let i = index + 1; i < statements.length; i++) {
          const later = statements[i]!
          const name = setterName(later)
          if (name) where(later, name)
          if (breaksTheTick(later)) break
        }
      })
    }
    if (ts.isTryStatement(node) && node.finallyBlock) {
      const navigates = leaves(node.tryBlock) || (node.catchClause && leaves(node.catchClause))
      if (navigates) {
        for (const statement of node.finallyBlock.statements) {
          const name = setterName(statement)
          if (name) where(statement, name)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

describe('a screen leaving by router.replace or router.back', () => {
  it('does not change its own state in the same tick', () => {
    expect(ROOTS.flatMap(sourceFiles).flatMap(offences)).toEqual([])
  })
})

/*
 * The same failure from inside the shared button. Its face gains a
 * `transform` while pressed, and without `collapsable={false}` Fabric
 * un-flattens it on every press — creating a native view and moving the
 * label into it. A press that also navigates the screen away (the onboarding
 * finish button) ran that move in the detaching commit: a white page on
 * every tap, reproduced on a Release APK on 28 September 2026.
 */
describe('the shared Button', () => {
  it('keeps its pressed face a real view', () => {
    const button = readFileSync(path.join(MOBILE, 'src/components/ui/Button.tsx'), 'utf8')
    expect(button).toMatch(/collapsable=\{false\}/)
  })
})
