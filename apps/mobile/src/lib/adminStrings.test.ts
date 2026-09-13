import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ADMIN } from './adminStrings'

/**
 * The operator panel is English, and this is what makes that a fact rather
 * than a habit.
 *
 * There are three layers keeping it that way — a lint rule pointing the
 * opposite direction to the project's own convention, a note at the top of
 * `adminStrings.ts`, and this. The lint rule catches the import; this catches
 * the other half, a screen that reaches for `t()` through some path the rule
 * did not name, and it also catches a string table with a hole in it.
 *
 * Mobile vitest cannot load `react-native` (`vitest.config.ts` restricts it to
 * `src/lib` and `src/i18n`, and Flow syntax is why), so the screens themselves
 * are unreachable from a test. Reading them off disk is what is left, and it
 * is the same thing `routeLiterals.test.ts` does for the same reason.
 */

const ADMIN_SCREENS = path.join(__dirname, '../../app/(app)/admin')

function screenFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return screenFiles(full)
    return entry.name.endsWith('.tsx') ? [full] : []
  })
}

/** Every leaf of the table, so a missing one is found rather than rendered blank. */
function leaves(value: unknown, trail: string[] = []): { path: string; value: unknown }[] {
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, child]) => leaves(child, [...trail, key]))
  }
  return [{ path: trail.join('.'), value }]
}

describe('the operator panel’s words', () => {
  it('has no empty or missing entry', () => {
    for (const leaf of leaves(ADMIN)) {
      if (typeof leaf.value === 'function') continue
      expect(typeof leaf.value, leaf.path).toBe('string')
      expect(String(leaf.value).trim().length, leaf.path).toBeGreaterThan(0)
    }
  })

  it('every function in it returns something', () => {
    // The interpolating entries — `Pay 1500 tokens`, `3 other reports`. A
    // typo in one of these is a screen that renders "undefined" at a person.
    for (const leaf of leaves(ADMIN)) {
      if (typeof leaf.value !== 'function') continue
      const rendered = (leaf.value as (...args: unknown[]) => string)(1, 'x')
      expect(typeof rendered, leaf.path).toBe('string')
      expect(rendered, leaf.path).not.toContain('undefined')
    }
  })

  it('is the only place the admin screens get words from', () => {
    const files = screenFiles(ADMIN_SCREENS)
    // If this is ever zero the assertions below pass vacuously, which would be
    // the quietest possible way for this test to stop meaning anything.
    expect(files.length).toBeGreaterThan(0)

    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      const where = path.relative(ADMIN_SCREENS, file)
      expect(source, where).not.toMatch(/from '[^']*\/i18n['/]/)
      expect(source, where).not.toMatch(/\buseT\b/)
      expect(source, where).not.toMatch(/\bt\(['"]/)
      expect(source, where).toContain('adminStrings')
    }
  })
})
