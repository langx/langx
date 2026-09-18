import { BADGES } from '@langx/shared'
import feather from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Feather.json'
import materialCommunity from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json'
import { describe, expect, it } from 'vitest'

/**
 * Every glyph the catalogue names has to exist in the set it names.
 *
 * `BadgeDefinition.icon` arrives at `BadgeGlyph` as a plain string and is cast
 * to each library's own union of names, so the compiler has nothing to check
 * and a typo renders **nothing at all** — an empty circle in a slot sized for
 * a glyph, on a screen nobody looks at every day. This is the check that would
 * have caught it.
 *
 * The maps are plain JSON, so this needs none of react-native — see
 * `docs/decisions.md` on why a mobile test that imports it cannot run.
 */
describe('badge glyphs', () => {
  const sets: Record<string, Record<string, number>> = {
    feather,
    'mci:': materialCommunity,
  }

  it('names a glyph that exists, in the set it says', () => {
    for (const badge of BADGES) {
      const mci = badge.icon.startsWith('mci:')
      const set = mci ? sets['mci:'] : sets.feather
      const name = mci ? badge.icon.slice(4) : badge.icon
      expect(set?.[name], `${badge.id} → ${badge.icon}`).toBeTypeOf('number')
    }
  })

  /**
   * A Feather name that also exists in MaterialCommunityIcons draws either
   * way, so a missing `mci:` would not fail above — it would quietly draw the
   * wrong picture. Only the two the prefix is for are allowed to carry it.
   */
  it('uses the prefix only where Feather has nothing', () => {
    for (const badge of BADGES) {
      if (!badge.icon.startsWith('mci:')) continue
      expect(sets.feather?.[badge.icon.slice(4)], badge.id).toBeUndefined()
    }
  })
})
