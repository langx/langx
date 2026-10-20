import { readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * The corner and header glyphs that `flags.v3Home` draws with the kit's
 * `IconButton` keep today's hand-rolled `Pressable` beside them for the flag
 * off, and the promise is that only the drawing differs: the same handler,
 * the same screen-reader name and hint, the same `hitSlop`, the same
 * `disabled`. Two copies of one control are two places for one to drift, so
 * this holds every `IconButton` in these files to a `Pressable` twin.
 *
 * Read over the AST and compared as source text, so `onPress={onBack}` and
 * `onPress={() => onBack()}` count as different — which is the point: the
 * copies are meant to be the same expression, not merely equivalent ones.
 *
 * The count per file is pinned too, so a site that loses its v3 branch, or
 * gains one this test has not been told about, fails here.
 */
const MOBILE = path.resolve(__dirname, '../..')

const SITES: Readonly<Record<string, number>> = {
  'src/components/ui/ScreenHeader.tsx': 1,
  'app/(app)/chat/new.tsx': 1,
  'app/(app)/filters.tsx': 1,
  'app/(app)/compose.tsx': 1,
  'app/(app)/scan.tsx': 1,
  'app/(app)/echo/cards.tsx': 2,
  'app/(app)/echo/card/[id].tsx': 1,
  'app/(app)/view-once.tsx': 2,
  'app/(app)/chat-camera.tsx': 3,
  'app/(app)/recap.tsx': 1,
  'src/components/PhotoViewer.tsx': 3,
  'src/components/PeopleSearch.tsx': 1,
  'src/components/Tip.tsx': 1,
  'src/components/UpdateBanner.tsx': 1,
  'src/components/testimonials/TestimonialCard.tsx': 1,
  'src/components/testimonials/ThreadTestimonialCard.tsx': 1,
  'src/screens/PostScreen.tsx': 1,
}

/** What a press does and what a screen reader hears. Looks are free to differ. */
const KEPT = ['onPress', 'accessibilityLabel', 'accessibilityHint', 'hitSlop', 'disabled'] as const

type Kept = Partial<Record<(typeof KEPT)[number], string>>

interface Element {
  name: string
  attributes: Kept
  role: string | undefined
}

function attributeText(attribute: ts.JsxAttribute, source: ts.SourceFile): string {
  const value = attribute.initializer
  if (!value) return 'true'
  const inner = ts.isJsxExpression(value) && value.expression ? value.expression : value
  return inner.getText(source).replace(/\s+/g, ' ')
}

function elements(file: string): { found: Element[]; usesFlag: boolean } {
  const text = readFileSync(path.join(MOBILE, file), 'utf8')
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: Element[] = []
  let usesFlag = false
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'useV3Home') {
      usesFlag = true
    }
    const opening = ts.isJsxElement(node)
      ? node.openingElement
      : ts.isJsxSelfClosingElement(node)
        ? node
        : undefined
    if (opening) {
      const name = opening.tagName.getText(source)
      if (name === 'IconButton' || name === 'Pressable') {
        const attributes: Kept = {}
        let role: string | undefined
        for (const property of opening.attributes.properties) {
          if (!ts.isJsxAttribute(property)) continue
          const key = property.name.getText(source)
          if (key === 'accessibilityRole') role = attributeText(property, source)
          if ((KEPT as readonly string[]).includes(key)) {
            attributes[key as (typeof KEPT)[number]] = attributeText(property, source)
          }
        }
        found.push({ name, attributes, role })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return { found, usesFlag }
}

function same(a: Kept, b: Kept): boolean {
  return KEPT.every((key) => a[key] === b[key])
}

describe('IconButton migration parity', () => {
  for (const [file, count] of Object.entries(SITES)) {
    describe(file, () => {
      const { found, usesFlag } = elements(file)
      const icons = found.filter((each) => each.name === 'IconButton')
      const pressables = found.filter((each) => each.name === 'Pressable')

      it('switches on the flag', () => {
        expect(usesFlag).toBe(true)
      })

      it(`draws ${count} IconButton${count === 1 ? '' : 's'}`, () => {
        expect(icons).toHaveLength(count)
      })

      for (const [index, icon] of icons.entries()) {
        it(`IconButton ${index + 1} (${icon.attributes.accessibilityLabel ?? '?'}) keeps its twin's handler and words`, () => {
          const twin = pressables.find(
            (each) => each.role === '"button"' && same(each.attributes, icon.attributes),
          )
          expect(twin, JSON.stringify(icon.attributes)).toBeDefined()
        })
      }
    })
  }
})
