import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useColorScheme, type ViewStyle } from 'react-native'
import * as SystemUI from 'expo-system-ui'
import { FLAG_KEYS, readFlag, writeFlag } from '../localFlags'
import {
  font,
  layout,
  palettes,
  radius,
  spacing,
  type ColorScheme,
  type ThemeColors,
} from './tokens'

/**
 * `auto` is the default and follows the device. The explicit settings exist
 * because the device preference is a whole-phone decision and this app is a
 * place people read long passages of a language they are still learning —
 * wanting it light at night, or dark in a bright room, is a legitimate thing to
 * want and costs us one stored string.
 */
export const THEME_PREFERENCES = ['auto', 'light', 'dark'] as const
export type ThemePreference = (typeof THEME_PREFERENCES)[number]

function isPreference(value: string | null): value is ThemePreference {
  return value !== null && (THEME_PREFERENCES as readonly string[]).includes(value)
}

export interface Theme {
  scheme: ColorScheme
  colors: ThemeColors
  cardShadow: ViewStyle
  spacing: typeof spacing
  radius: typeof radius
  font: typeof font
  layout: typeof layout
}

interface ThemeContextValue {
  theme: Theme
  preference: ThemePreference
  setPreference: (next: ThemePreference) => void
}

function buildTheme(scheme: ColorScheme): Theme {
  return { scheme, ...palettes[scheme], spacing, radius, font, layout }
}

/**
 * Light is the fallback rather than `undefined`, so a component rendered
 * outside the provider — a test, a Storybook-less snapshot — still gets a real
 * palette instead of throwing. Missing the provider should look wrong, not
 * crash.
 */
const ThemeContext = createContext<ThemeContextValue>({
  theme: buildTheme('light'),
  preference: 'auto',
  setPreference: () => undefined,
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const deviceScheme = useColorScheme()
  const [preference, setPreferenceState] = useState<ThemePreference>('auto')

  // Read-once hydration. Until it lands the app renders `auto`, which is the
  // same thing the stored value usually says — so the common case has no flash
  // at all, and the uncommon one flashes once rather than blocking the splash
  // on a storage round-trip.
  useEffect(() => {
    let cancelled = false
    void readFlag(FLAG_KEYS.themePreference).then((stored) => {
      if (!cancelled && isPreference(stored)) setPreferenceState(stored)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next)
    void writeFlag(FLAG_KEYS.themePreference, next)
  }, [])

  // `useColorScheme` can also report 'unspecified'; anything that is not an
  // explicit 'dark' is treated as light.
  const scheme: ColorScheme =
    preference === 'auto' ? (deviceScheme === 'dark' ? 'dark' : 'light') : preference

  /**
   * The one surface React does not paint: the Android window behind the root
   * view, and the web `<body>` the overscroll rubber-band exposes. Both keep
   * their default — white — so in dark mode a pull past the top of any list
   * flashed white behind a `#1c1e26` app.
   *
   * `expo-system-ui` was already a dependency and had never been called. It
   * needs no lazy import the way `expo-notifications` does: the package ships
   * an `.web.js` that sets `document.body.style.backgroundColor`, so Metro
   * resolves a real implementation on both platforms.
   */
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(palettes[scheme].colors.bg)
  }, [scheme])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: buildTheme(scheme), preference, setPreference }),
    [scheme, preference, setPreference],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): Theme {
  return useContext(ThemeContext).theme
}

/** For the Settings row that switches it; everything else wants `useTheme`. */
export function useThemePreference(): Omit<ThemeContextValue, 'theme'> {
  const { preference, setPreference } = useContext(ThemeContext)
  return { preference, setPreference }
}
