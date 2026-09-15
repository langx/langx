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
  /**
   * The screen sits inside the tab navigator. The bar below it already pays
   * the bottom inset — that padding is what keeps its five words off the home
   * indicator — and the tabs are laid out beside the scene rather than over
   * it, so a screen that pays the inset again stops a home indicator's worth
   * of air short of the tab line and leaves a band of bare background there.
   * On the phone only: a browser's bottom inset is zero, which is why the web
   * build never showed it.
   */
  tabbed?: boolean
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
  tabbed = false,
  style,
}: ScreenProps) {
  const styles = useStyles()

  const insets = useSafeAreaInsets()
  const padding = {
    paddingTop: insets.top,
    paddingBottom: tabbed ? 0 : insets.bottom,
  }

  const inner = <View style={[styles.column, fluid && styles.fluid, style]}>{children}</View>

  if (scroll) {
    return (
      <ScrollView
        style={styles.root}
        /*
         * The safe area belongs to the content here, not to the scroll view.
         * On iOS a `RefreshControl` is a child of the scroll view, so padding
         * on the scroll view's own style pushes the control down with
         * everything else: the spinner came to rest behind the status bar
         * while the content started a notch below it, which is the detached
         * spinner over an empty band. Padding the content container leaves
         * the scroll view flush with the screen, and `progressViewOffset`
         * puts the spinner back where the pull actually opens.
         */
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + CONTENT_BOTTOM, paddingTop: insets.top + CONTENT_TOP },
        ]}
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
         *
         * Off when there is a refresh control, because on iOS the two fight
         * over the same `contentInset` and the keyboard wins. A
         * `RefreshControl` is a child of the scroll view there rather than a
         * wrapper around it, so with the inset managed out from under it the
         * spinner never appears at all: a pull on Me or on the wallet
         * refetched in complete silence, which reads as a screen that does
         * not refresh. The lists get their spinner because a `FlatList`
         * passes no such prop. Nothing is lost by the split — no screen in
         * the app both pulls to refresh and holds a text field.
         */
        automaticallyAdjustKeyboardInsets={!onRefresh}
        {...(onRefresh
          ? {
              refreshControl: (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  progressViewOffset={insets.top}
                />
              ),
            }
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

// Nearly flush to the status bar at the top — the header row brings its own
// air — and 28 at the bottom so the last row is not sitting on the home
// indicator. Added to the safe-area insets rather than set beside them,
// because the content container now carries both.
const CONTENT_TOP = 6
const CONTENT_BOTTOM = 28

const useStyles = makeStyles(({ colors, layout }) => ({
  root: { backgroundColor: colors.bg, flex: 1 },
  centre: { alignItems: 'center' },
  scrollContent: { alignItems: 'center' },
  column: { maxWidth: layout.maxWidth, paddingHorizontal: GUTTER, width: '100%' },
  fluid: { flex: 1, maxWidth: Platform.OS === 'web' ? layout.maxWidth : undefined },
}))
