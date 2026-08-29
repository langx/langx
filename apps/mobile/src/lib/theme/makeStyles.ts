import { StyleSheet } from 'react-native'
import { useTheme, type Theme } from './ThemeProvider'
import type { ColorScheme } from './tokens'

type NamedStyles = Parameters<typeof StyleSheet.create>[0]

/**
 * The replacement for a module-scope `StyleSheet.create({...})`.
 *
 * The old idiom read the palette at import time, which is the single reason
 * dark mode could not exist: every screen froze the light values into its
 * stylesheet before React had rendered anything. Passing the theme in as an
 * argument is what unfreezes it.
 *
 * The result is cached per scheme, not per component instance — there are only
 * ever two schemes, so each stylesheet is built at most twice for the life of
 * the process and switching themes is as cheap as the old constant lookup.
 * That matters most on `chat/[id]`, which re-renders on every socket frame.
 */
export function makeStyles<T extends NamedStyles>(factory: (theme: Theme) => T): () => T {
  const cache = new Map<ColorScheme, T>()

  return function useStyles(): T {
    const theme = useTheme()
    let styles = cache.get(theme.scheme)
    if (!styles) {
      styles = StyleSheet.create(factory(theme))
      cache.set(theme.scheme, styles)
    }
    return styles
  }
}
