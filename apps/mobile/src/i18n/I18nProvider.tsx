import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  isRtlLocale,
  resolveLocale,
  type Locale,
} from '@langx/shared'
import { getLocales } from 'expo-localization'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { I18nManager, Platform } from 'react-native'
import { FLAG_KEYS, readFlag, writeFlag } from '../lib/localFlags'
import { createTranslate, setActiveLocale, type TranslateFn } from './runtime'

/** `auto` follows the device; anything else is an explicit override. */
export const LOCALE_PREFERENCES = ['auto', ...SUPPORTED_LOCALES] as const
export type LocalePreference = (typeof LOCALE_PREFERENCES)[number]

function isPreference(value: string | null): value is LocalePreference {
  return value !== null && (LOCALE_PREFERENCES as readonly string[]).includes(value)
}

/**
 * The device's languages, most preferred first.
 *
 * `getLocales()` is synchronous on every platform, which is what lets the very
 * first render already be in the right language — the alternative, an async
 * read, means every user outside English sees an English flash on launch.
 */
function deviceLocale(): Locale {
  try {
    return resolveLocale(getLocales().map((l) => l.languageTag))
  } catch {
    // A platform that cannot answer is not a reason to fail to start.
    return DEFAULT_LOCALE
  }
}

interface I18nContextValue {
  locale: Locale
  isRtl: boolean
  t: TranslateFn
  preference: LocalePreference
  setPreference: (next: LocalePreference) => void
}

/**
 * English rather than `undefined`, so a component rendered outside the
 * provider — a unit test, a screen imported in isolation — still produces real
 * text. Missing the provider should look untranslated, not throw.
 */
const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  isRtl: false,
  t: createTranslate(DEFAULT_LOCALE),
  preference: 'auto',
  setPreference: () => undefined,
})

/**
 * Turns the layout around for Arabic.
 *
 * On native this is a **process-level** switch: `I18nManager.forceRTL` only
 * takes effect on the next launch, so the flag is set and the app is left to
 * pick it up — either on the user's next cold start, or immediately if
 * `expo-updates` can reload the bundle. Doing it and reloading is the lesser
 * evil: the alternative is every `flexDirection: 'row'` in the app needing a
 * conditional, which is the bug factory this API exists to avoid.
 *
 * On web there is no such restriction; `dir` on the document element flips
 * the same layouts live.
 */
function applyDirection(isRtl: boolean): void {
  if (Platform.OS === 'web') {
    const root = globalThis.document?.documentElement
    if (root) root.dir = isRtl ? 'rtl' : 'ltr'
    return
  }
  if (I18nManager.isRTL === isRtl) return
  I18nManager.allowRTL(isRtl)
  I18nManager.forceRTL(isRtl)
  void reloadForDirection()
}

async function reloadForDirection(): Promise<void> {
  try {
    const Updates = await import('expo-updates')
    await Updates.reloadAsync()
  } catch {
    // A dev client, a build without expo-updates, a reload that is refused:
    // the flag is already stored, so the next cold start is correct anyway.
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<LocalePreference>('auto')
  const [device] = useState<Locale>(deviceLocale)

  // Read-once hydration, mirroring the theme: `auto` is what most people have
  // stored, so the common case never flashes and the uncommon one flashes once
  // instead of holding the splash open on a storage round-trip.
  useEffect(() => {
    let cancelled = false
    void readFlag(FLAG_KEYS.localePreference).then((stored) => {
      if (!cancelled && isPreference(stored)) setPreferenceState(stored)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const setPreference = useCallback((next: LocalePreference) => {
    setPreferenceState(next)
    void writeFlag(FLAG_KEYS.localePreference, next)
  }, [])

  const locale: Locale = preference === 'auto' ? device : preference
  const isRtl = isRtlLocale(locale)

  // During render rather than in an effect: `lib/alert.ts` can be called from
  // the same tick a locale change lands in, and an effect would leave it one
  // render behind — a dialog in the language the user just left.
  setActiveLocale(locale)

  useEffect(() => {
    applyDirection(isRtl)
  }, [isRtl])

  const value = useMemo<I18nContextValue>(
    () => ({ locale, isRtl, t: createTranslate(locale), preference, setPreference }),
    [locale, isRtl, preference, setPreference],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

/** The one every screen wants. */
export function useT(): TranslateFn {
  return useContext(I18nContext).t
}

/** For anything that needs the locale itself — `Intl` formatters, mostly. */
export function useLocale(): { locale: Locale; isRtl: boolean } {
  const { locale, isRtl } = useContext(I18nContext)
  return { locale, isRtl }
}

/** For the Settings row that switches it; everything else wants `useT`. */
export function useLocalePreference(): {
  preference: LocalePreference
  setPreference: (next: LocalePreference) => void
  deviceLocale: Locale
} {
  const { preference, setPreference } = useContext(I18nContext)
  return { preference, setPreference, deviceLocale: deviceLocale() }
}
