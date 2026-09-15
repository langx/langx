import { useEffect, useRef } from 'react'
import {
  Animated,
  Keyboard,
  Platform,
  type FocusEvent,
  type HostInstance,
  type KeyboardEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type View,
} from 'react-native'
import { spacing } from '../lib/theme'

/**
 * Keeps the keyboard off a text field inside a scroll view that cannot use
 * `automaticallyAdjustKeyboardInsets` — because the view pulls to refresh
 * (`Screen` says why the two are not combined) or because something under
 * it, a button row, has to ride up with the keyboard too. The comment box on
 * a post, the correction box on a feed row and the answer box in an Echo
 * session were each covered by the keyboard they had just summoned, and
 * this is the one answer for all three.
 *
 * Two things, both measured rather than assumed:
 *
 * - `frameRef` goes on the view that wraps the screen's content and `pad` is
 *   how far the keyboard reaches into it: the view's bottom edge in the
 *   window against the keyboard's top edge. Measured, because the edge is
 *   not where the safe-area inset says — a tab bar sits under the feed and
 *   the keyboard covers that first. The wrapper pads itself by `pad` and
 *   everything in it, the scroll view included, gets shorter. The padding is
 *   inside the measured view, so its frame is the same whatever the pad
 *   currently is, and a keyboard that changes height is measured from the
 *   same baseline.
 * - `fieldProps` go on every text field. When the keyboard announces where
 *   its top will be, the focused field is measured against it and the scroll
 *   view scrolled by the overlap, no more — a field already in view stays
 *   where it is. `scrollProps` go on the scroll view: they track its offset,
 *   since a scroll-to is absolute, and set `scrollToOverflowEnabled`. Without
 *   that the scroll is clamped to the bounds the view still has at that
 *   moment — full height, with the pad only starting to shrink it — and the
 *   offset that is right once the keyboard is up is out of range when asked
 *   for. The pad lands before the scroll finishes and the offset is valid
 *   again. Scrolled as the keyboard rises rather than after it, so the two
 *   move together.
 *
 * iOS only, and nothing here is attached anywhere else. Android's story is
 * the whole window: the manifest asks for `adjustResize`, `KeyboardResizeHost`
 * gives that back where Android 15's edge-to-edge took it away, and a scroll
 * view that shrinks brings its focused child back into view itself —
 * `ReactScrollView` extends the framework's own, whose `onSizeChanged` does
 * exactly that. So `scrollProps` is empty off iOS rather than merely unused:
 * `scrollEventThrottle` at 16 means no throttling at all, and Android ignores
 * it in any case, so leaving the listener on would fire a scroll event per
 * frame down the feed — the app's longest list — for a handler with nothing
 * to do. `useKeyboardInset` is the same pad for a screen whose composer sits
 * outside the scroll view, as the chat thread's does.
 */
export function useKeyboardClearance(scrollTo: (offset: number) => void) {
  const ios = Platform.OS === 'ios'
  const pad = useRef(new Animated.Value(0)).current
  const frameRef = useRef<View>(null)
  const scrollY = useRef(0)
  const field = useRef<HostInstance | null>(null)
  const scroll = useRef(scrollTo)
  scroll.current = scrollTo

  useEffect(() => {
    if (!ios) return
    // Follows `keyboardWillChangeFrame`'s timing: the keyboard's own
    // duration, and a linear curve since the keyboard's is private.
    const follow = (event: KeyboardEvent, toValue: number) =>
      Animated.timing(pad, {
        toValue,
        duration: event.duration || 250,
        easing: (t) => t,
        useNativeDriver: false,
      }).start()
    const show = Keyboard.addListener('keyboardWillShow', (event) => {
      const top = event.endCoordinates.screenY
      frameRef.current?.measureInWindow((_x, y, _width, height) =>
        follow(event, Math.max(0, y + height - top)),
      )
      field.current?.measureInWindow((_x, y, _width, height) => {
        const covered = y + height + spacing.md - top
        if (covered > 0) scroll.current(scrollY.current + covered)
      })
    })
    const hide = Keyboard.addListener('keyboardWillHide', (event) => follow(event, 0))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [ios, pad])

  return {
    pad,
    frameRef,
    scrollProps: ios
      ? {
          scrollToOverflowEnabled: true,
          scrollEventThrottle: 16,
          onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            scrollY.current = event.nativeEvent.contentOffset.y
          },
        }
      : {},
    fieldProps: {
      onFocus: (event: FocusEvent) => {
        field.current = event.target
      },
      onBlur: () => {
        field.current = null
      },
    },
  }
}
