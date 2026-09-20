import { BADGES } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { BADGE_ART } from './badgeArt'

describe('badge art', () => {
  /**
   * The bond nothing else checks.
   *
   * The catalogue names the picture each badge wears; this module holds the
   * files. A name with no file draws an empty square on somebody's phone, and
   * a file no badge names is weight in the bundle nobody can see. TypeScript
   * sees neither, because one side is a string and the other a
   * `Record<string, number>`.
   */
  it('has a file for every picture the catalogue names', () => {
    for (const badge of BADGES) {
      expect(BADGE_ART[badge.icon], `${badge.id} → ${badge.icon}`).toBeDefined()
    }
  })

  it('ships no file the catalogue does not name', () => {
    const named = new Set(BADGES.map((badge) => badge.icon))

    expect(Object.keys(BADGE_ART).filter((name) => !named.has(name))).toEqual([])
  })
})
