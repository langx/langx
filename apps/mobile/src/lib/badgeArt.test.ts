import { BADGES } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { BADGE_ART } from './badgeArt'

describe('badge art', () => {
  /**
   * The bond nothing else checks.
   *
   * The catalogue names the badges; this module holds their pictures. A badge
   * with no picture draws an empty square on somebody's phone, and a picture
   * no badge claims is weight in the bundle nobody can see. TypeScript sees
   * neither, because one side is data and the other a `Record<string, number>`.
   */
  it('has a picture for every badge in the catalogue', () => {
    for (const badge of BADGES) {
      expect(BADGE_ART[badge.id], `${badge.id} has no picture`).toBeDefined()
    }
  })

  it('ships no picture for a badge the catalogue does not have', () => {
    const ids = new Set(BADGES.map((badge) => badge.id))

    expect(Object.keys(BADGE_ART).filter((id) => !ids.has(id))).toEqual([])
  })

  /**
   * The rule the whole set exists for, and one the types cannot see: two
   * entries pointing at one file is a copied line that compiles.
   */
  it('gives every badge a picture of its own', () => {
    const files = Object.values(BADGE_ART)

    expect(new Set(files).size, 'a picture is used twice').toBe(files.length)
  })

  /**
   * The reason this is keyed by id at all. `icon` is what an app older than
   * the server draws with, so it is frozen at the six vector-font names those
   * builds understand — see `BadgeDefinition.icon`. A picture name leaking
   * back into it would put question marks on live profiles again.
   */
  it('leaves the DTO icon out of it', () => {
    const glyphs = new Set([
      'mci:sprout',
      'zap',
      'check',
      'message-square',
      'mci:hand-coin',
      'calendar',
    ])

    for (const badge of BADGES) {
      expect(glyphs.has(badge.icon), `${badge.id} → ${badge.icon}`).toBe(true)
    }
  })
})
