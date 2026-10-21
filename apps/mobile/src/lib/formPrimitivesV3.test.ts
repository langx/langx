import { readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { isMessageKey } from './v3ScreenParity'

/**
 * The form primitives — `Chip`, `FormField`, `LoadFailed`, `Skeleton`,
 * `EmptyState` — switch to the v3 look themselves under `flags.v3Home`, so
 * the v3 screens built on them (Echo, Edit profile, Languages, the language
 * pick, Propose a time) change without being touched. Unlike a screen's twin
 * the v3 drawing sits in the same file, in an `if (v3Look)` branch or a
 * style ternary; this holds that branch to the one under it: the same words,
 * the same screen-reader roles, and every prop the caller handed in.
 *
 * Read over the AST, so a comment that names a key does not count.
 */
const MOBILE = path.resolve(__dirname, '../..')

const FILES = {
  chip: 'src/components/ui/Chip.tsx',
  formField: 'src/components/ui/FormField.tsx',
  loadFailed: 'src/components/LoadFailed.tsx',
  skeleton: 'src/components/ui/Skeleton.tsx',
  emptyState: 'src/components/ui/EmptyState.tsx',
} as const

/**
 * Words the current branch draws that the v3 one leaves out, and why. The
 * screen reader still hears `common.showPassword` / `common.hidePassword`.
 */
const DROPPED: Readonly<Record<string, string>> = {
  // `PasswordFieldV3`'s eye replaces the visible word, so the two v3 password fields agree.
  'common.show': 'eye glyph',
  'common.hide': 'eye glyph',
}

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    readFileSync(path.join(MOBILE, file), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
}

interface Said {
  keys: Set<string>
  roles: Set<string>
  /** JSX attribute names given on the branch's elements. */
  attributes: Set<string>
}

function empty(): Said {
  return { keys: new Set(), roles: new Set(), attributes: new Set() }
}

/** The `if (v3Look) { … }` branch, and everything else in the file. */
function split(file: string): { v3: Said; current: Said; branches: number } {
  const source = parse(file)
  const v3 = empty()
  const current = empty()
  let branches = 0
  const visit = (node: ts.Node, into: Said): void => {
    if (
      ts.isIfStatement(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'v3Look'
    ) {
      branches += 1
      visit(node.thenStatement, v3)
      if (node.elseStatement) visit(node.elseStatement, into)
      return
    }
    if (ts.isJsxAttribute(node)) into.attributes.add(node.name.getText(source))
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const parent = node.parent
      if (ts.isJsxAttribute(parent) && parent.name.getText(source) === 'accessibilityRole') {
        into.roles.add(node.text)
      } else if (isMessageKey(node.text)) {
        into.keys.add(node.text)
      }
    }
    ts.forEachChild(node, (child) => visit(child, into))
  }
  visit(source, current)
  return { v3, current, branches }
}

function callsUseV3Home(file: string): boolean {
  const source = parse(file)
  let found = false
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'useV3Home'
    ) {
      found = true
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

describe('v3 form primitives', () => {
  it.each(Object.values(FILES))('%s switches on the flag itself', (file) => {
    expect(callsUseV3Home(file)).toBe(true)
  })

  it.each([FILES.formField, FILES.loadFailed])(
    "%s's v3 branch says every word and role the current one does",
    (file) => {
      const { v3, current, branches } = split(file)
      expect(branches).toBe(1)
      expect([...current.keys].filter((key) => !v3.keys.has(key) && !(key in DROPPED))).toEqual([])
      expect([...current.roles].filter((role) => !v3.roles.has(role))).toEqual([])
    },
  )

  it("FormField's v3 branch still reveals a password and counts", () => {
    const { v3 } = split(FILES.formField)
    for (const attribute of ['secureTextEntry', 'suffix', 'error', 'accessibilityState']) {
      expect(v3.attributes).toContain(attribute)
    }
    // The count is text in both branches, not an attribute.
    const text = readFileSync(path.join(MOBILE, FILES.formField), 'utf8')
    expect(text.match(/\{used\} \/ \{maxLength\}/g)?.length).toBe(2)
  })

  it("EmptyState's v3 branch hands on everything the caller gave", () => {
    const { v3, branches } = split(FILES.emptyState)
    expect(branches).toBe(1)
    for (const prop of ['icon', 'title', 'body', 'actionLabel', 'onAction', 'actionVariant']) {
      expect(v3.attributes).toContain(prop)
    }
  })
})
