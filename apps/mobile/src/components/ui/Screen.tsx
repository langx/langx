import type { ReactNode } from 'react'
import { Platform, RefreshControl, ScrollView, View, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { makeStyles } from '../../lib/theme'

interface ScreenProps {
  children: ReactNode
  scroll?: boolean
  /** Turn off the centred max-width column — chat wants the full height. */
  fluid?: boolean
  /** Pull-to-refresh. Only meaningful together with `scroll`. */
  onRefresh?: () => void
  refreshing?: boolean
  style?: ViewStyle
}

/**
 * Every screen's outer shell: safe-area padding on phones, a centred column on
 * wide browsers. Without the column, the same layout that reads well on a
 * 390px phone spreads a single line of text across a desktop monitor.
 */
export function Screen({
  children,
  scroll = false,
  fluid = false,
  onRefresh,
  refreshing = false,
  style,
}: ScreenProps) {
  const styles = useStyles()

  const insets = useSafeAreaInsets()
  const padding = {
    paddingTop: insets.top,
    paddingBottom: insets.bottom,
  }

  const inner = <View style={[styles.column, fluid && styles.fluid, style]}>{children}</View>

  if (scroll) {
    return (
      <ScrollView
        style={[styles.root, padding]}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        /*
         * The keyboard insets the scroll view and the focused field is kept
         * above it. Without this a `TextInput` low on a scrolling screen is
         * simply covered as you type into it — the language picker's search
         * box was, which made adding a second language look broken.
         *
         * iOS-only by design, and a no-op elsewhere: Android resizes the
         * window for the keyboard already (`adjustResize`), so doing this
         * there would inset twice. `useKeyboardInset` exists for the screens
         * that do not scroll and documents the same split.
         */
        automaticallyAdjustKeyboardInsets
        {...(onRefresh
          ? { refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> }
          : {})}
      >
        {inner}
      </ScrollView>
    )
  }
  return <View style={[styles.root, padding, styles.centre]}>{inner}</View>
}

const useStyles = makeStyles(({ colors, spacing, layout }) => ({
  root: { backgroundColor: colors.bg, flex: 1 },
  centre: { alignItems: 'center' },
  scrollContent: { alignItems: 'center', paddingVertical: spacing.lg },
  column: { maxWidth: layout.maxWidth, paddingHorizontal: spacing.lg, width: '100%' },
  fluid: { flex: 1, maxWidth: Platform.OS === 'web' ? layout.maxWidth : undefined },
}))
