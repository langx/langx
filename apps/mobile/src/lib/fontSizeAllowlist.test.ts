import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * The literal-`fontSize` allowlist only shrinks, and this is what makes it.
 *
 * ESLint ignores a listed file entirely, so a file that has moved onto the
 * type ramp but stayed on the list is unguarded: the next literal size typed
 * into it passes lint. This fails instead, naming the file to take off.
 *
 * The check mirrors the rule's selectors in `eslint.config.mjs` — a
 * `fontSize` property or JSX attribute whose value is a literal, a
 * conditional with a literal branch, or arithmetic with a literal operand —
 * because a file that the rule would no longer flag is exactly a file the
 * list no longer needs.
 */

const ROOT = path.join(__dirname, '../../../..')
const LIST = path.join(ROOT, 'eslint.font-size-allowlist.mjs')

/**
 * Listed by a pull request that was open when the rule landed, so they may
 * not exist yet on the branch this runs on. Once they are on `main` this set
 * does nothing, and can go.
 */
const NOT_YET_ON_MAIN = new Set([
  'apps/mobile/app/(app)/admin/measure.tsx',
  'apps/mobile/src/components/admin/MoneyTimeline.tsx',
  'apps/mobile/src/components/admin/StatTable.tsx',
])

function listedPaths(): string[] {
  const source = readFileSync(LIST, 'utf8')
  return [...source.matchAll(/^ {2}'([^']+)',$/gm)].map((match) => match[1]!)
}

function isLiteral(node: ts.Node): boolean {
  return (
    ts.isNumericLiteral(node) ||
    ts.isStringLiteral(node) ||
    (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand))
  )
}

/** Whether a `fontSize` value is, or directly contains, a typed-in size. */
function isLiteralSize(node: ts.Node): boolean {
  if (isLiteral(node)) return true
  if (ts.isParenthesizedExpression(node)) return isLiteralSize(node.expression)
  if (ts.isConditionalExpression(node)) return isLiteral(node.whenTrue) || isLiteral(node.whenFalse)
  if (ts.isBinaryExpression(node)) return isLiteral(node.left) || isLiteral(node.right)
  return false
}

function namedFontSize(name: ts.Node): boolean {
  return (ts.isIdentifier(name) || ts.isStringLiteral(name)) && name.text === 'fontSize'
}

function hasLiteralFontSize(code: string): boolean {
  const source = ts.createSourceFile(
    'file.tsx',
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  let found = false
  const visit = (node: ts.Node): void => {
    if (found) return
    if (ts.isPropertyAssignment(node) && namedFontSize(node.name)) {
      found = isLiteralSize(node.initializer)
    } else if (ts.isJsxAttribute(node) && namedFontSize(node.name) && node.initializer) {
      const value = ts.isJsxExpression(node.initializer)
        ? node.initializer.expression
        : node.initializer
      found = value !== undefined && isLiteral(value)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

describe('the literal-fontSize allowlist', () => {
  it('is read, rather than passing vacuously', () => {
    expect(listedPaths().length).toBeGreaterThan(0)
  })

  it('names only files that still type a size in place', () => {
    const stale: string[] = []
    for (const listed of listedPaths()) {
      const file = path.join(ROOT, listed)
      if (!existsSync(file)) {
        if (!NOT_YET_ON_MAIN.has(listed)) stale.push(`${listed} (no such file)`)
        continue
      }
      if (!hasLiteralFontSize(readFileSync(file, 'utf8'))) stale.push(listed)
    }
    // Each of these is on the type ramp now: take it off the list in
    // `eslint.font-size-allowlist.mjs`, so the rule guards it again.
    expect(stale).toEqual([])
  })

  it('recognises what the rule refuses, and nothing else', () => {
    expect(hasLiteralFontSize('const s = { fontSize: 13 }')).toBe(true)
    expect(hasLiteralFontSize('const s = { fontSize: compact ? 13 : size }')).toBe(true)
    expect(hasLiteralFontSize('const s = { fontSize: 13 * k }')).toBe(true)
    expect(hasLiteralFontSize('const t = <SvgText fontSize={11} />')).toBe(true)
    expect(hasLiteralFontSize('const s = { fontSize: v3.type.body.fontSize }')).toBe(false)
    expect(hasLiteralFontSize('const s = { ...v3.type.body }')).toBe(false)
  })
})
