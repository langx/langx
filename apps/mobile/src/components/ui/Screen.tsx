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

/**
 * v3's gutter is 20, not the 16 of the spacing scale: the rows run edge to
 * edge inside it, and at 16 a hairline divider sits too close to the bezel to
 * read as part of the content.
 */
const GUTTER = 20

const useStyles = makeStyles(({ colors, layout }) => ({
  root: { backgroundColor: colors.bg, flex: 1 },
  centre: { alignItems: 'center' },
  // Nearly flush to the status bar at the top — the header row brings its own
  // air — and 28 at the bottom so the last row is not sitting on the home
  // indicator.
  scrollContent: { alignItems: 'center', paddingBottom: 28, paddingTop: 6 },
  column: { maxWidth: layout.maxWidth, paddingHorizontal: GUTTER, width: '100%' },
  fluid: { flex: 1, maxWidth: Platform.OS === 'web' ? layout.maxWidth : undefined },
}))
