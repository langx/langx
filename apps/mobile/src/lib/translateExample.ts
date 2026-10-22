import { isRtlLocale, SUPPORTED_LOCALES, type Locale } from '@langx/shared'

/**
 * Which two copies of `settings.translateExample` the translate picker's
 * example card shows: the sentence "in" a language this person is learning,
 * and the same sentence in the language they have chosen to read
 * translations in.
 *
 * Both are hand-written copies from the app's own catalogues, not a machine
 * translation — asking the translator for a picture would spend somebody's
 * daily allowance on decoration. That limits the card to the app's eight
 * interface languages, so for a target outside them there is no card at
 * all (`null`) rather than one in the wrong language. The source falls back
 * to English, then Spanish, when nothing they learn is one of the eight.
 *
 * Pure and free of `react-native`, so vitest can pin it.
 */
export function translateExampleLocales(
  target: string | undefined,
  learning: readonly { code: string }[],
): { from: Locale; to: Locale } | null {
  const to = target ? localeFor(target) : undefined
  if (!to) return null
  const from = [...learning.map((language) => language.code), 'en', 'es']
    .map(localeFor)
    .find((locale) => locale !== undefined && locale !== to)
  return from ? { from, to } : null
}

/** An interface locale for a language code, by its base: `pt` is `pt-BR`. */
function localeFor(code: string): Locale | undefined {
  const base = code.split('-')[0]!.toLowerCase()
  return SUPPORTED_LOCALES.find((locale) => locale.split('-')[0]!.toLowerCase() === base)
}

/**
 * How one of the card's sentences is set when its language may run the other
 * way from the interface: Arabic in an English app, English in an Arabic one.
 * Each sentence takes its own direction and sits at its own start edge.
 *
 * `textAlign` is written as the interface sees it: in a right-to-left layout
 * React Native swaps `left` and `right` (`I18nManager.doLeftAndRightSwapInRTL`),
 * so `left` is the layout's start and `right` its end. A sentence that reads
 * the interface's way starts at the start; one that reads against it, at the end.
 */
export function sentenceDirection(
  locale: Locale,
  interfaceRtl: boolean,
): { writingDirection: 'ltr' | 'rtl'; textAlign: 'left' | 'right' } {
  const rtl = isRtlLocale(locale)
  return {
    writingDirection: rtl ? 'rtl' : 'ltr',
    textAlign: rtl === interfaceRtl ? 'left' : 'right',
  }
}
