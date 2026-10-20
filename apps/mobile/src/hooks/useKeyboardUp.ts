import { useEffect, useState } from 'react'
import { Keyboard, Platform } from 'react-native'
import { keyboardCovering } from '../lib/keyboardCovering'

/** Read once: a page cannot grow a finger, and `navigator` is absent while the web build exports. */
const HAS_TOUCH =
  Platform.OS !== 'web' || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0)

/**
 * Whether a soft keyboard is covering the screen — see `keyboardCovering`.
 * `fieldFocused` is the composer's field, which only the web reads.
 *
 * `enabled` false listens to nothing and answers false, so a screen that
 * only needs this in one look re-renders on no keyboard in the other.
 *
 * iOS reports the keyboard as it starts to move, so the fold happens with it
 * rather than after it; Android only reports it once it is up.
 */
export function useKeyboardUp(enabled: boolean, fieldFocused: boolean): boolean {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return
    const ios = Platform.OS === 'ios'
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () =>
      setShown(true),
    )
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setShown(false),
    )
    return () => {
      show.remove()
      hide.remove()
    }
  }, [enabled])

  if (!enabled) return false
  return keyboardCovering({
    os: Platform.OS,
    touch: HAS_TOUCH,
    keyboardShown: shown,
    fieldFocused,
  })
}
