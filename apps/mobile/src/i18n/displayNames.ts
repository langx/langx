import { getCountry, getLanguage, type Locale } from '@langx/shared'
import { useMemo } from 'react'
import { DISPLAY_NAMES } from './displayNameData'
import { useLocale } from './I18nProvider'

/**
 * Language and country names in the reader's language.
 *
 * These two lists are the largest body of user-facing text in the app — some
 * 450 entries between them — and translating them by hand into eight locales
 * would be both enormous and worse than CLDR's own names. So they are CLDR's:
 * a Turkish reader sees "Almanca" without a single string being written here.
 *
 * They come from a generated table, not `Intl.DisplayNames`, because Hermes
 * ships no `Intl.DisplayNames` on iOS or Android — the constructor threw, the
 * lookup fell through, and every phone showed English names while the web
 * build showed translated ones. The table is used on the web too, so both
 * builds name a language the same way.
 *
 * The English name from `@langx/shared` stays as the fallback, for English
 * itself and for the handful of codes CLDR has no name for. Note this only
 * changes what is *displayed*: the stored value is the ISO code either way, so
 * two people running different locales still match on the same language.
 */
export interface DisplayNames {
  language: (code: string) => string
  country: (code: string) => string
}

export function displayNamesFor(locale: Locale): DisplayNames {
  const table = locale === 'en' ? undefined : DISPLAY_NAMES[locale]
  return {
    language: (code) => table?.languages[code] ?? getLanguage(code)?.name ?? code,
    country: (code) => {
      const upper = code.toUpperCase()
      return table?.countries[upper] ?? getCountry(upper)?.name ?? code
    },
  }
}

export function useDisplayNames(): DisplayNames {
  const { locale } = useLocale()
  return useMemo(() => displayNamesFor(locale), [locale])
}
