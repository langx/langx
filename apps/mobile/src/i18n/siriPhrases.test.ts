import { describe, expect, it } from 'vitest'
import { catalogs } from './catalogs'
import {
  APPLICATION_NAME,
  applicationNameCount,
  SIRI_PHRASES,
  SIRI_SHORTCUTS,
  SIRI_SOURCE,
  tokensIn,
} from './siriPhrases'

const locales = Object.keys(catalogs) as (keyof typeof SIRI_PHRASES)[]

describe('the Siri phrases', () => {
  it('cover every locale the app speaks', () => {
    expect(Object.keys(SIRI_PHRASES).sort()).toEqual([...locales].sort())
  })

  /**
   * The rule that has no error message anywhere else.
   *
   * Apple matches a phrase only when it carries the app-name token exactly
   * once. Drop it and iOS neither warns nor rejects — the shortcut is simply
   * deaf in that language. It is the kind of thing a translator does without
   * meaning to, and the kind of thing nobody notices until somebody speaks
   * Arabic at their phone.
   */
  it('carry the app name exactly once, in every language', () => {
    for (const locale of locales) {
      for (const shortcut of SIRI_SHORTCUTS) {
        for (const phrase of SIRI_PHRASES[locale][shortcut]) {
          // The phrase rides along in the assertion so a failure names the
          // sentence rather than reporting that 0 is not 1.
          expect({ phrase, count: applicationNameCount(phrase) }).toEqual({ phrase, count: 1 })
        }
      }
    }
  })

  /**
   * The catalogue is keyed by the English phrase and every translation sits
   * under its own key, so a locale with a different number of phrases would
   * either lose one or be handed the wrong one. The types already say two;
   * this says the same thing where a future third would be counted.
   */
  it('line up one for one with English', () => {
    for (const shortcut of SIRI_SHORTCUTS) {
      const source = SIRI_PHRASES[SIRI_SOURCE][shortcut]
      for (const locale of locales) {
        expect({ locale, shortcut, length: SIRI_PHRASES[locale][shortcut].length }).toEqual({
          locale,
          shortcut,
          length: source.length,
        })
      }
    }
  })

  /**
   * A translation says the same thing only if it names the same things.
   * `${conversation}` is the one at risk — it reads like a placeholder
   * somebody could helpfully translate, and a phrase that loses it matches
   * nothing in that language for ever.
   */
  it('name the same tokens English names', () => {
    for (const shortcut of SIRI_SHORTCUTS) {
      SIRI_PHRASES[SIRI_SOURCE][shortcut].forEach((source, index) => {
        const want = [...tokensIn(source)].sort()
        for (const locale of locales) {
          const phrase = SIRI_PHRASES[locale][shortcut][index] ?? ''
          expect({ locale, phrase, tokens: [...tokensIn(phrase)].sort() }).toEqual({
            locale,
            phrase,
            tokens: want,
          })
        }
      })
    }
  })

  it('are all different, so no key is written twice', () => {
    const english = SIRI_SHORTCUTS.flatMap((shortcut) => [...SIRI_PHRASES[SIRI_SOURCE][shortcut]])
    expect(new Set(english).size).toBe(english.length)
  })

  /**
   * Siri is given a sentence, not a placeholder. A phrase that is only the
   * token would be "LangX" — which is the wake word for the app itself and
   * matches nothing useful.
   */
  it('say something besides the app name', () => {
    for (const locale of locales) {
      for (const shortcut of SIRI_SHORTCUTS) {
        for (const phrase of SIRI_PHRASES[locale][shortcut]) {
          expect(phrase.replace(APPLICATION_NAME, '').trim().length).toBeGreaterThan(2)
        }
      }
    }
  })
})
