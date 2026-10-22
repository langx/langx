import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * Nothing absolutely positioned against one side may name that side
 * physically — `end: 4`, never `right: 4`.
 *
 * On a phone the difference is invisible: Yoga swaps `left` and `right` under
 * `I18nManager.forceRTL`, so a play badge pinned `right` lands in the bottom
 * left in Arabic, as it should. react-native-web swaps only the logical
 * properties, so on the web the same badge stayed bottom right while the
 * thumbnail row around it mirrored — corner marks on the wrong corner, and a
 * remove × on the far side of the photo it removes. `docs/decisions.md`
 * (_Arabic is why the layout uses `start`/`end`_) asks for logical properties
 * throughout; this holds the line for the case that only shows on the web.
 *
 * A block that sets both sides (`left: 0, right: 0` to stretch) is symmetric
 * and fine either way, and a computed value — a slider's `left: 30%`, a menu
 * placed from a measured `x` — is measured in physical pixels on purpose.
 */
const MOBILE = path.join(__dirname, '..', '..')

/** Physical on purpose, each for the reason its own comment gives. */
const PHYSICAL_ON_PURPOSE = new Set([
  // The burst's paths are worked out in screen coordinates from this origin.
  'src/components/thread/EmojiBurstV3.tsx',
  // An invisible copy measured for its width; which side it hides on is moot.
  'src/components/ui/FitText.tsx',
])
const ROOTS = ['src', 'app'].map((dir) => path.join(MOBILE, dir))

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(full)
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : []
  })
}

function isNumber(node: ts.Expression): boolean {
  if (ts.isNumericLiteral(node)) return true
  return ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)
}

function oneSidedCorners(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const found: string[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isObjectLiteralExpression(node)) {
      const props = new Map<string, ts.Expression>()
      for (const prop of node.properties) {
        if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
          props.set(prop.name.text, prop.initializer)
        }
      }
      const position = props.get('position')
      const absolute =
        position !== undefined && ts.isStringLiteral(position) && position.text === 'absolute'
      const left = props.get('left')
      const right = props.get('right')
      const side = left && !right ? left : right && !left ? right : undefined
      if (absolute && side && isNumber(side)) {
        const { line } = source.getLineAndCharacterOfPosition(side.getStart())
        found.push(`${path.relative(MOBILE, file)}:${line + 1}`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

describe('corner marks on the web in Arabic', () => {
  it('pins absolute badges with start/end, not left/right', () => {
    const files = ROOTS.flatMap(sourceFiles).filter(
      (f) =>
        !f.includes(`${path.sep}admin${path.sep}`) &&
        !PHYSICAL_ON_PURPOSE.has(path.relative(MOBILE, f).split(path.sep).join('/')),
    )
    expect(files.flatMap(oneSidedCorners)).toEqual([])
  })
})
