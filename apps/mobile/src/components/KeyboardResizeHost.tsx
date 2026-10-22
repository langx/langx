import { type ReactNode, useEffect, useReducer, useRef } from 'react'
import { Keyboard, Platform, TextInput, View, type KeyboardEvent } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  KEYBOARD_PAD_CHECK_MS,
  KEYBOARD_PAD_IDLE,
  keyboardPad,
  nextKeyboardPad,
} from '../lib/keyboardPad'

/**
 * Gives Android back the window resize the keyboard used to cause.
 *
 * The manifest says `adjustResize`, and until Android 15 that was the whole
 * keyboard story on Android: the window shrank to the keyboard's top edge,
 * every screen got shorter, and the composer stayed in view. Android 15
 * started drawing apps edge to edge, Android 16 made that mandatory, and an
 * edge-to-edge window is by definition the whole screen — there is no
 * boundary for the system to shrink it to, so `adjustResize` is silently
 * ignored and the keyboard simply covers whatever was at the bottom. React
 * Native 0.86 turns edge-to-edge on but adds no padding of its own, and the
 * app's own keyboard code was written for iOS because Android "already did
 * it". On a Galaxy S24 running Android 16 the chat composer was under the
 * keyboard on every message.
 *
 * Once, here, rather than per screen: the resize was global, so its
 * replacement is too. The pad is measured, not assumed — how far the
 * keyboard reaches into this view, less the navigation-bar inset every
 * screen already leaves at the bottom. On a phone where the window still
 * resizes (Android 14 and below) the keyboard reaches nothing and the pad
 * is zero, which is what keeps the two mechanisms from stacking.
 *
 * Android has no `keyboardWillShow`, so the pad lands when the keyboard has
 * finished appearing — the same moment `adjustResize` used to relayout.
 *
 * The events are not trusted to take it away again on their own. A pad that
 * outlived its keyboard padded every screen after it, so the tab bar was lifted
 * off the bottom or cut off below it: the bar vanished while moving between
 * pages. So a measurement that lands after the hide that followed it is
 * dropped, and while there is a pad, it is let go as soon as no text input is
 * focused (`nextKeyboardPad`).
 */
export function KeyboardResizeHost({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'android') return <>{children}</>
  return <AndroidKeyboardResize>{children}</AndroidKeyboardResize>
}

function AndroidKeyboardResize({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets()
  const bottom = useRef(insets.bottom)
  bottom.current = insets.bottom
  const root = useRef<View>(null)
  const [{ pad }, dispatch] = useReducer(nextKeyboardPad, KEYBOARD_PAD_IDLE)
  // Numbers every show and hide, so a measurement knows which one it was for.
  const events = useRef(0)

  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event: KeyboardEvent) => {
      const forShow = ++events.current
      dispatch({ type: 'show', shown: forShow })
      // `screenY` is the keyboard's top edge in window coordinates, and the
      // padding is inside this view, so the frame measured here is the full
      // one whatever the pad currently is — a keyboard that changes height
      // (the emoji panel) is measured from the same baseline.
      root.current?.measureInWindow((_x, y, _width, height) => {
        dispatch({
          type: 'measured',
          shown: forShow,
          pad: keyboardPad({
            viewBottom: y + height,
            keyboardTop: event.endCoordinates.screenY,
            bottomInset: bottom.current,
          }),
        })
      })
    })
    const hide = Keyboard.addListener('keyboardDidHide', () =>
      dispatch({ type: 'hide', shown: ++events.current }),
    )
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])

  // Only while padded: nothing to watch otherwise.
  useEffect(() => {
    if (pad === 0) return
    const timer = setInterval(() => {
      dispatch({ type: 'check', inputFocused: inputFocused() })
    }, KEYBOARD_PAD_CHECK_MS)
    return () => clearInterval(timer)
  }, [pad])

  return (
    // `collapsable={false}`: a view that exists only to be measured must not
    // be flattened out of the native tree.
    <View ref={root} collapsable={false} style={{ flex: 1, paddingBottom: pad }}>
      {children}
    </View>
  )
}

/**
 * Whether a text input on screen holds the focus.
 *
 * `currentlyFocusedInput()` alone is not enough: an input unmounted while
 * focused — the composer of a chat that was just popped — is unregistered
 * before React Native tries to blur it, the blur is then skipped, and the dead
 * field stays "focused" for good. A detached one is not typing into anything.
 */
function inputFocused(): boolean {
  const input = TextInput.State.currentlyFocusedInput() as { isConnected?: boolean } | null
  return input != null && input.isConnected !== false
}
