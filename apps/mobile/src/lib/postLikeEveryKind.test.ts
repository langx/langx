import { readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'

/**
 * Every post kind carries the post's like, on v3's feed card and on the post's
 * page. The v3 card once drew the heart on a moment only, so an ask had no way
 * to be liked from the feed, although the server takes a like on any post that
 * is not your own.
 *
 * The app's tests have no renderer (see `vitest.config.ts`), so this reads the
 * JSX: the post's `LikeButton` must exist, and nothing on its way up to the
 * component may make it depend on what the post asks — on the card, nothing
 * may make it conditional at all. A rewrite that wraps it in `ask ? … : …`
 * again fails here.
 */
const MOBILE = path.resolve(__dirname, '../..')

/** Words a condition uses when it is about the post's kind rather than its loading. */
const KIND_WORDS = /\b(ask|asks|kind|moment|correcting|pronouncing)\b/

function postLikeButtons(file: string): { source: ts.SourceFile; nodes: ts.Node[] } {
  const text = readFileSync(path.join(MOBILE, file), 'utf8')
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const nodes: ts.Node[] = []
  const visit = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 'LikeButton') {
      const target = node.attributes.properties.find(
        (prop) => ts.isJsxAttribute(prop) && prop.name.getText(source) === 'targetType',
      )
      if (target?.getText(source) === 'targetType="post"') nodes.push(node)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return { source, nodes }
}

/** The conditions between a node and the function that draws it. */
function conditionsAbove(node: ts.Node, source: ts.SourceFile): string[] {
  const found: string[] = []
  for (let at = node.parent; at && !ts.isSourceFile(at); at = at.parent) {
    if (ts.isConditionalExpression(at)) found.push(at.condition.getText(source))
    if (
      ts.isBinaryExpression(at) &&
      (at.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
        at.operatorToken.kind === ts.SyntaxKind.BarBarToken)
    ) {
      found.push(at.left.getText(source))
    }
    if (ts.isIfStatement(at)) found.push(at.expression.getText(source))
    if (ts.isFunctionDeclaration(at) || ts.isArrowFunction(at) || ts.isFunctionExpression(at)) {
      break
    }
  }
  return found
}

describe('the post like on every post kind', () => {
  it("v3's feed card draws it unconditionally, for an ask and a moment alike", () => {
    const { source, nodes } = postLikeButtons('src/components/posts/PostCard.tsx')
    expect(nodes).toHaveLength(1)
    expect(conditionsAbove(nodes[0]!, source)).toEqual([])
  })

  it("the post's page draws it whatever the post asks", () => {
    const { source, nodes } = postLikeButtons('src/screens/PostScreen.tsx')
    expect(nodes.length).toBeGreaterThan(0)
    for (const node of nodes) {
      for (const condition of conditionsAbove(node, source)) {
        expect(condition).not.toMatch(KIND_WORDS)
      }
    }
  })
})
