import { readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * The thread's overlays — the long-press menu, the emoji picker, the parts
 * and word sheets, search, send-later, the forward picker, the upload bubble
 * and the link cards — take v3's look under `flags.v3Home` inside their own
 * files rather than in twins: each keeps its current stylesheet, `useStyles`,
 * and gains a `useStylesV3` it swaps in when the flag is on, the way
 * `CallMenu` does. Every handler, string and role is then shared by
 * construction, so what this holds is the part a compiler does not:
 *
 * - both sheets name the same entries, so no element is left drawn in the
 *   current look under v3, or unstyled in either;
 * - the v3 sheet reads v3's tokens alone, never the current palette;
 * - no size is typed in the v3 sheet. These files are still on
 *   `eslint.font-size-allowlist.mjs` for their current sheets, so the lint
 *   rule does not look inside them, and this does it for the v3 half;
 * - the file reads the flag at all.
 */
const SRC = path.resolve(__dirname, '..')

const FILES = [
  'components/MessageMenuHost.tsx',
  'components/ReactionPicker.tsx',
  'components/MessagePartsSheet.tsx',
  'components/WordLookup.tsx',
  'components/ChatSearch.tsx',
  'components/ScheduleTimeSheet.tsx',
  'components/ConversationPicker.tsx',
  'components/PendingMediaBubble.tsx',
  'components/LinkPreviewCard.tsx',
  'components/ProfileLinkCard.tsx',
] as const

/** No stylesheet of its own: one glyph, coloured in place. */
const FLAG_ONLY = ['components/DiscardUnsentButton.tsx'] as const

function parse(file: string): ts.SourceFile {
  const full = path.join(SRC, file)
  return ts.createSourceFile(
    full,
    readFileSync(full, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
}

/** The arrow handed to `makeStyles` for the stylesheet bound to `name`. */
function factoryOf(source: ts.SourceFile, name: string): ts.ArrowFunction | undefined {
  let found: ts.ArrowFunction | undefined
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      node.initializer.expression.getText(source) === 'makeStyles'
    ) {
      const arg = node.initializer.arguments[0]
      if (arg && ts.isArrowFunction(arg)) found = arg
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

function entriesOf(factory: ts.ArrowFunction, source: ts.SourceFile): string[] {
  let body: ts.Node = factory.body
  while (ts.isParenthesizedExpression(body)) body = body.expression
  if (!ts.isObjectLiteralExpression(body)) throw new Error('a stylesheet that is not an object')
  return body.properties.map((property) => property.name?.getText(source) ?? '').sort()
}

function tokensOf(factory: ts.ArrowFunction, source: ts.SourceFile): string[] {
  const param = factory.parameters[0]
  if (!param || !ts.isObjectBindingPattern(param.name)) return []
  return param.name.elements.map((element) => element.name.getText(source))
}

function typedSizes(factory: ts.ArrowFunction, source: ts.SourceFile): string[] {
  const found: string[] = []
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(source) === 'fontSize' &&
      ts.isNumericLiteral(node.initializer)
    ) {
      found.push(node.getText(source))
    }
    ts.forEachChild(node, visit)
  }
  visit(factory.body)
  return found
}

function readsFlag(source: ts.SourceFile): boolean {
  let found = false
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'useV3Home') found = true
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

describe('thread overlays in v3', () => {
  for (const file of FILES) {
    describe(file, () => {
      const source = parse(file)
      const current = factoryOf(source, 'useStyles')
      const redesigned = factoryOf(source, 'useStylesV3')

      it('reads the flag', () => {
        expect(readsFlag(source)).toBe(true)
      })

      it('styles the same entries in both looks', () => {
        expect(current, 'useStyles').toBeDefined()
        expect(redesigned, 'useStylesV3').toBeDefined()
        expect(entriesOf(redesigned!, source)).toEqual(entriesOf(current!, source))
      })

      it("draws v3's look from v3's tokens alone", () => {
        expect(tokensOf(redesigned!, source)).toEqual(['v3'])
      })

      it('types no size in the v3 sheet', () => {
        expect(typedSizes(redesigned!, source)).toEqual([])
      })
    })
  }

  for (const file of FLAG_ONLY) {
    it(`${file} reads the flag`, () => {
      expect(readsFlag(parse(file))).toBe(true)
    })
  }
})
