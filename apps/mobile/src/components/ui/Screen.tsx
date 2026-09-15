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
      /*
       * The safe area insets this wrapper, not the scroll view and not its
       * content container. On iOS the pull spinner is drawn against the top
       * edge of the scroll view's own frame, so a scroll view that starts at
       * the top of the screen puts its spinner behind the status bar — which
       * is exactly where it sat, a loose mark beside the clock above an empty
       * band, whichever way the padding inside was arranged.
       *
       * The lists have never had the problem, and this is the difference:
       * they are the branch below, a padded `View` with a `FlatList` inside,
       * so their scroll view begins under the status bar and the spinner
       * lands where the pull opens. The scroll branch is that shape now too.
       */
      <View style={[styles.root, padding]}>
        <ScrollView
          style={styles.fill}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          /*
           * The keyboard insets the scroll view and the focused field is kept
           * above it. Without this a `TextInput` low on a scrolling screen is
           * simply covered as you type into it — the language picker's search
           * box was, which made adding a second language look broken.
           *
           * iOS-only by design, and a no-op elsewhere: Android is padded for
           * the keyboard once, at the root, by `KeyboardResizeHost`, so doing
           * this there would inset twice. `useKeyboardInset` exists for the
           * screens that do not scroll and documents the same split.
           *
           * Off when there is a refresh control, because on iOS the two fight
           * over the same `contentInset` and the keyboard wins: with the inset
           * managed out from under it the spinner does not appear at all, and
           * a pull on Me or on the wallet refetched in complete silence.
           * The one screen that both pulls to refresh and holds a text field,
           * the post thread, pads itself with `useKeyboardInset` instead.
           */
          automaticallyAdjustKeyboardInsets={!onRefresh}
          {...(onRefresh
            ? { refreshControl: <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> }
            : {})}
        >
          {inner}
        </ScrollView>
      </View>
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
  fill: { flex: 1 },
  // Nearly flush to the status bar at the top — the header row brings its own
  // air — and 28 at the bottom so the last row is not sitting on the home
  // indicator. Beside the wrapper's safe-area padding, not folded into it.
  scrollContent: { alignItems: 'center', paddingBottom: 28, paddingTop: 6 },
  column: { maxWidth: layout.maxWidth, paddingHorizontal: GUTTER, width: '100%' },
  fluid: { flex: 1, maxWidth: Platform.OS === 'web' ? layout.maxWidth : undefined },
}))
