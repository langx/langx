import { useEffect, useRef } from 'react'
import { Animated, Keyboard, Platform, type KeyboardEvent } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

/**
 * How much of the screen's bottom the keyboard is covering, as an animated
 * value to pad a screen with — the padding `KeyboardAvoidingView` is meant to
 * supply and, here, did not.
 *
 * RN's `KeyboardAvoidingView` derives the overlap from its own layout frame,
 * and that frame is relative to its parent rather than to the window. The
 * chat screen wrapped only the composer in one and it padded nothing; wrapped
 * around the whole screen it padded about an inset's worth too little, and
 * the composer stayed under the keyboard either way. The keyboard event
 * itself says exactly how tall the keyboard is, so this reads that and
 * subtracts the bottom inset the screen already pads — the arithmetic has
 * nothing to measure and nothing to get wrong.
 *
 * iOS only. Android resizes the window for the keyboard (`adjustResize`), so
 * the value stays at zero there and nothing is padded twice. Follows
 * `keyboardWillChangeFrame`, so the pad moves with the keyboard rather than
 * after it, and takes the animation's own duration and curve.
 */
export function useKeyboardInset(): Animated.Value {
  const insets = useSafeAreaInsets()
  const inset = useRef(new Animated.Value(0)).current
  const bottom = useRef(insets.bottom)
  bottom.current = insets.bottom

  useEffect(() => {
    if (Platform.OS !== 'ios') return
    const follow = (event: KeyboardEvent) => {
      // The keyboard's height less the home-indicator inset the screen
      // already leaves — the keyboard covers that strip too.
      const target = Math.max(0, event.endCoordinates.height - bottom.current)
      Animated.timing(inset, {
        toValue: target,
        duration: event.duration || 250,
        easing: (t) => t,
        useNativeDriver: false,
      }).start()
    }
    const show = Keyboard.addListener('keyboardWillShow', follow)
    const hide = Keyboard.addListener('keyboardWillHide', (event) => {
      Animated.timing(inset, {
        toValue: 0,
        duration: event.duration || 250,
        easing: (t) => t,
        useNativeDriver: false,
      }).start()
    })
    return () => {
      show.remove()
      hide.remove()
    }
  }, [inset])

  return inset
}
