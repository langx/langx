import { LANGUAGE_LEVELS } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { LEVEL_ICON } from './languageLevel'

describe('LEVEL_ICON', () => {
  // A fifth level would otherwise render as a blank space where the icon goes,
  // on a screen that no longer prints the level as text to fall back on.
  it('covers every level', () => {
    for (const level of LANGUAGE_LEVELS) expect(LEVEL_ICON[level]).toBeTruthy()
  })

  it('gives each level its own icon', () => {
    expect(new Set(Object.values(LEVEL_ICON)).size).toBe(LANGUAGE_LEVELS.length)
  })
})
