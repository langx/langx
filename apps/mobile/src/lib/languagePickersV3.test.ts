import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { isMessageKey, uses } from './v3ScreenParity'

/**
 * The language pickers' v3 drawing (`V-LanguagePick`, `V-Languages`) next to
 * the parts it replaces. `settingsScreensV3.test.ts` already holds the two
 * pages to their routes; this holds the pieces those pages stopped borrowing:
 * the v3 pick page drew `LanguagePicker`'s chips, and now draws its own, so
 * it must still say everything that component said. The level radios replace
 * chips that had no role, and the current look must not pick up either piece.
 */
const SRC = path.resolve(__dirname, '..')
const APP = path.resolve(__dirname, '../../app')
const file = (...parts: string[]) => path.join(...parts)

describe('the v3 language pickers keep the current pickers’ words', () => {
  it('the v3 pick page says everything LanguagePicker says', () => {
    const before = uses(file(SRC, 'components/LanguagePicker.tsx'))
    const after = uses(file(SRC, 'screens/settings/LanguagePickScreenV3.tsx'))
    expect(before.keys.size).toBeGreaterThan(0)
    for (const key of before.keys) expect(after.keys, `key ${key}`).toContain(key)
  })

  it('a level is a radio in a named group', () => {
    const levels = uses(file(SRC, 'components/languages/LevelChoiceV3.tsx'))
    expect(levels.roles).toContain('radiogroup')
    expect(levels.roles).toContain('radio')
    const page = uses(file(SRC, 'screens/settings/LanguagesScreenV3.tsx'))
    expect(page.keys).toContain('languages.levelGroup')
  })

  it('the new words exist in English (and so, by type, in every locale)', () => {
    expect(isMessageKey('languages.allLanguages')).toBe(true)
    expect(isMessageKey('languages.levelGroup')).toBe(true)
  })

  it('the current look draws none of the v3 pieces', () => {
    const current = [
      file(SRC, 'components/LanguagePicker.tsx'),
      file(APP, '(app)/languages/index.tsx'),
      file(APP, '(app)/languages/pick.tsx'),
      file(APP, '(onboarding)/languages.tsx'),
    ]
    for (const page of current) {
      const text = readFileSync(page, 'utf8')
      expect(text, page).not.toContain('LanguageChipV3')
      expect(text, page).not.toContain('LevelChoiceV3')
    }
  })
})
