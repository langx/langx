import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Every `Screen` inside the tab navigator is marked `tabbed`.
 *
 * Without it the screen pays the bottom safe-area inset a second time — the
 * tab bar already pays it — and the list stops a home indicator's worth of air
 * above the tab line, leaving a band of bare background there. Nothing else
 * catches it: it type-checks, it renders, and the web build cannot show it at
 * all, because a browser's bottom inset is zero.
 */
// Relative to the package root, like `routeLiterals` — vitest runs there.
const TABS = path.join('app', '(app)', '(tabs)')

describe('tab screens', () => {
  const files = readdirSync(TABS).filter((f) => f.endsWith('.tsx') && f !== '_layout.tsx')

  it.each(files)('%s marks every Screen as tabbed', (file) => {
    const source = readFileSync(path.join(TABS, file), 'utf8')
    const opens = source.match(/<Screen\b[^>]*>/g) ?? []
    expect(opens.length).toBeGreaterThan(0)
    for (const open of opens) expect(open).toMatch(/\btabbed\b/)
  })
})
