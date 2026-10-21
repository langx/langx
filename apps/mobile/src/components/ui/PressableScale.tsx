/**
 * Press feedback, app-wide. One answer per kind of surface, so a tap feels
 * the same wherever it lands:
 *
 * 1. Anything that commits or opens — buttons, icon buttons, chips, radios,
 *    tiles, cards, tabs, banners, toasts — is a `PressableScale`.
 *    - Scale: `PRESS_SCALE` (0.97) for a button, `PRESS_SCALE_CARD` (0.98)
 *      for a card or tile, `PRESS_SCALE_GLYPH` (0.88) for a lone glyph.
 *    - Timing: `DURATION.press` (120 ms) in, `DURATION.release` (150 ms)
 *      out, on `EASE_OUT`, on the native driver.
 *    - With reduce motion on: no scale, the face dims to 0.7 while held.
 * 2. Rows, list cells and text links dim to `PRESS_OPACITY` (0.6) and do
 *    not shrink: a whole row moving under the thumb reads as the list
 *    jumping.
 * 3. Scrims and surfaces that only answer a long press give no feedback at
 *    all. No `android_ripple` anywhere: it is the one press that would look
 *    different on one platform.
 * 4. No opacity literal in a screen. A press dims by `PRESS_OPACITY` or by
 *    nothing; a sixth value is how there came to be six.
 */
import { useRef, type ReactNode } from 'react'
import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { makeStyles } from '../../lib/theme'
import { EASE_OUT } from '../../lib/theme/motionAnimated'
import { DURATION, PRESS_SCALE } from '../../lib/theme/motionValues'

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  children: ReactNode
  /** The view that shrinks — the face a person sees. */
  style?: StyleProp<ViewStyle>
  /** The `Pressable` round it: the touch area, which does not shrink. */
  touchStyle?: StyleProp<ViewStyle>
  /** How far it shrinks. `PRESS_SCALE` unless the thing pressed is far bigger or smaller than a button. */
  scaleTo?: number
}

/**
 * A `Pressable` whose face shrinks a little under the finger and comes back
 * when it lifts — the press every v3 control shares, so a button, a corner
 * glyph and a tile all answer a tap the same way.
 *
 * On React Native's `Animated`, not Reanimated, because `Button` is built on
 * it and `Button` is on the launch path, which stays on `Animated` (see
 * _The row swipe runs on the UI thread_ in `docs/decisions.md`). A press is a
 * fire-and-forget timing on one property nothing else reads, which the native
 * driver already runs off the JS thread; nothing here tracks a finger.
 *
 * With reduce motion on there is no scale at all: the face dims while it is
 * held, which says "pressed" without anything moving.
 *
 * The face is always a real native view (`collapsable={false}`), and it
 * carries its `transform` from the first render rather than gaining one on
 * press. On Android's Fabric, a view that gains a transform stops being
 * flattened into its parent, so a press used to create a native view and move
 * the label into it — and when the same press navigated the screen away
 * (`router.replace`), that move landed in the commit that detaches the screen
 * and Fabric failed with "addViewAt: … already has a parent": a white page in a
 * release build. The onboarding finish button did exactly that on every tap.
 */
export function PressableScale(props: PressableScaleProps) {
  const reduceMotion = useReduceMotion()
  return <PressableScaleBase {...props} reduceMotion={reduceMotion} />
}

/**
 * `PressableScale` for a caller that already reads reduce motion for itself —
 * `Button`, whose check needs it too — so a button on a long list subscribes
 * to the setting once rather than twice.
 */
export function PressableScaleBase({
  children,
  style,
  touchStyle,
  scaleTo = PRESS_SCALE,
  reduceMotion,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: PressableScaleProps & { reduceMotion: boolean }) {
  const styles = useStyles()
  const scale = useRef(new Animated.Value(1)).current

  const settle = (toValue: number, duration: number): void => {
    // A new timing on the same value stops the one in flight, so a tap that
    // lifts mid-shrink turns round from wherever the face got to.
    Animated.timing(scale, { toValue, duration, easing: EASE_OUT, useNativeDriver: true }).start()
  }

  return (
    <Pressable
      {...rest}
      disabled={disabled}
      style={touchStyle}
      onPressIn={(event) => {
        if (!reduceMotion) settle(scaleTo, DURATION.press)
        onPressIn?.(event)
      }}
      onPressOut={(event) => {
        // Always back to full size, even if reduce motion came on mid-press.
        if (reduceMotion) scale.setValue(1)
        else settle(1, DURATION.release)
        onPressOut?.(event)
      }}
    >
      {({ pressed }) => (
        <Animated.View
          collapsable={false}
          style={[
            style,
            { transform: [{ scale }] },
            reduceMotion && pressed && !disabled ? styles.dimmed : null,
          ]}
        >
          {children}
        </Animated.View>
      )}
    </Pressable>
  )
}

const useStyles = makeStyles(() => ({
  dimmed: { opacity: 0.7 },
}))
