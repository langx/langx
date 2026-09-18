import { useCallback, useEffect, useRef, type RefObject } from 'react'
import {
  Animated,
  Keyboard,
  Platform,
  type FocusEvent,
  type HostInstance,
  type KeyboardEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
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
 * - `fieldProps` go on every text field, and take the view that has to clear
 *   the keyboard along with it: a composer whose send button sits below the
 *   field is that view, and measuring the field alone parked the button under
 *   the keyboard every time — visible only to someone who thought to scroll.
 *   A field with nothing below it passes nothing. When the keyboard announces
 *   where its top will be, whichever was given is measured against it and the
 *   scroll view scrolled by the overlap, no more — a box already in view stays
 *   where it is. `scrollProps` go on the scroll view: they track its offset,
 *   since a scroll-to is absolute, and set `scrollToOverflowEnabled`. Without
 *   that the scroll is clamped to the bounds the view still has at that
 *   moment — full height, with the pad only starting to shrink it — and the
 *   offset that is right once the keyboard is up is out of range when asked
 *   for. The pad lands before the scroll finishes and the offset is valid
 *   again. Scrolled as the keyboard rises rather than after it, so the two
 *   move together.
 *
 * That is the iOS half. Android needs no `pad` — `KeyboardResizeHost` pays
 * that once at the root, where the window resize used to be — but it needs
 * the same scroll, and for the same reason: a scroll view that gets shorter
 * brings its *focused child* back into view by itself (`ReactScrollView`
 * extends the framework's own, whose `onSizeChanged` does exactly that), and
 * the focused child is the field, never the button under it.
 *
 * Its half is measured instead of followed, and takes a different signal:
 *
 * - The signal is `onLayout` on the scroll view. Android has no
 *   `keyboardWillShow`, and the height it would announce arrives one React
 *   commit later anyway — the root's pad lands on `keyboardDidShow` and the
 *   scroll view gets shorter after that. Scrolling before it would be clamped
 *   to the bounds the list still has, which is the same trap
 *   `scrollToOverflowEnabled` answers on iOS and Android has no flag for. The
 *   layout that shortens the list is therefore the moment to scroll, and it
 *   is also the moment the framework's own reveal has just run. `onFocus`
 *   asks again, because focus moving from one composer to the next while the
 *   keyboard is already up changes no layout and raises no event.
 * - `Keyboard.metrics()` rather than a remembered coordinate: it is null
 *   while the keyboard is down, so a layout with no keyboard does nothing
 *   without having to be told the keyboard has gone.
 * - The offset is measured rather than tracked, which is why `scrollProps`
 *   carries no `onScroll` here. Three rectangles in one pass — the box, the
 *   scroll view, and the content view `innerViewRef` hands over — and
 *   `viewY - contentY` is the offset the list is at. Adding the overlap to it
 *   gives a target that does not depend on the scroll position at all: both
 *   halves are read from the same state, so a scroll that native has not told
 *   JS about yet cancels out of the sum rather than becoming a jump. That
 *   matters here, where the framework has just scrolled on its own.
 *
 * `useKeyboardInset` is the same pad for a screen whose composer sits outside
 * the scroll view, as the chat thread's does.
 */
export function useKeyboardClearance(scrollTo: (offset: number) => void) {
  const ios = Platform.OS === 'ios'
  const android = Platform.OS === 'android'
  const pad = useRef(new Animated.Value(0)).current
  const frameRef = useRef<View>(null)
  const scrollY = useRef(0)
  const field = useRef<HostInstance | null>(null)
  const scroller = useRef<ScrollView>(null)
  const content = useRef<View>(null)
  const scroll = useRef(scrollTo)
  scroll.current = scrollTo

  /** Android's clearance: see the second half of the comment above. */
  const clear = useCallback(() => {
    const keyboard = Keyboard.metrics()
    const box = field.current
    const inner = content.current
    const view = scroller.current?.getNativeScrollRef()
    if (!keyboard || !box || !inner || !view) return
    box.measureInWindow((_x, y, _width, height) => {
      const covered = y + height + spacing.md - keyboard.screenY
      if (covered <= 0) return
      inner.measureInWindow((_ix, contentY) =>
        view.measureInWindow((_vx, viewY) => scroll.current(viewY - contentY + covered)),
      )
    })
  }, [])

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
      : android
        ? {
            /*
             * Cast because React Native declares both props `RefObject<T>`,
             * and React 19's `RefObject` is invariant — a ref that is null
             * until it mounts, which is every ref, cannot satisfy it.
             */
            innerViewRef: content as RefObject<View>,
            scrollViewRef: scroller as RefObject<ScrollView>,
            onLayout: clear,
          }
        : {},
    /*
     * Resolved at focus rather than held as a second ref: by the time a field
     * has focus its composer is laid out, so the one ref below is either the
     * field or the box around it and the keyboard handler has nothing to pick
     * between.
     */
    fieldProps: (block?: RefObject<View | null>) => ({
      onFocus: (event: FocusEvent) => {
        field.current = block?.current ?? event.target
        if (android) clear()
      },
      onBlur: () => {
        field.current = null
      },
    }),
  }
}
