import { getCountry, getLanguage, type Locale } from '@langx/shared'
import { useMemo } from 'react'
import { useLocale } from './I18nProvider'

/**
 * Language and country names in the reader's language.
 *
 * These two lists are the largest body of user-facing text in the app — some
 * 450 entries between them — and translating them by hand into eight locales
 * would be both enormous and worse than what every device already has.
 * `Intl.DisplayNames` reads the platform's own CLDR data, so a Turkish reader
 * sees "Almanca" and "Türkiye" without a single string being written here.
 *
 * The English name from `@langx/shared` stays as the fallback, for a partial
 * `Intl` and for the handful of codes CLDR has no name for. Note this only
 * changes what is *displayed*: the stored value is the ISO code either way, so
 * two people running different locales still match on the same language.
 */
export interface DisplayNames {
  language: (code: string) => string
  country: (code: string) => string
}

function build(locale: Locale): DisplayNames {
  let languages: Intl.DisplayNames | undefined
  let regions: Intl.DisplayNames | undefined
  try {
    languages = new Intl.DisplayNames([locale], { type: 'language' })
    regions = new Intl.DisplayNames([locale], { type: 'region' })
  } catch {
    // Left undefined; both lookups fall through to the English name.
  }

  return {
    language: (code) => {
      // `of()` returns the input unchanged for a code it does not know, which
      // would put a bare "haw" on screen — worse than the English name.
      const localized = safely(languages, code)
      return localized ?? getLanguage(code)?.name ?? code
    },
    country: (code) => {
      const localized = safely(regions, code)
      return localized ?? getCountry(code)?.name ?? code
    },
  }
}

function safely(names: Intl.DisplayNames | undefined, code: string): string | undefined {
  if (!names) return undefined
  try {
    const value = names.of(code)
    return value && value.toLowerCase() !== code.toLowerCase() ? value : undefined
  } catch {
    return undefined
  }
}

export function useDisplayNames(): DisplayNames {
  const { locale } = useLocale()
  return useMemo(() => build(locale), [locale])
}
