import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Animated, Easing, View, type StyleProp, type ViewStyle } from 'react-native'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { makeStyles } from '../../lib/theme'

/** Long enough to read as a dissolve; short enough that nothing waits on it. */
const DURATION = 240
/** The paywall's curve (`Reveal`): fastest as the content arrives. */
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1)

/**
 * A placeholder that dissolves into what it stood for.
 *
 * Until `ready` the skeleton is all there is. When it turns true the content
 * takes the layout and fades up while the skeleton, laid over it, fades out —
 * both on screen at once, so there is never a frame with neither. Fading the
 * content in after the skeleton had gone would leave exactly that: a blank
 * beat, which reads as a flicker rather than as arriving.
 *
 * **The skeleton has to be the content's size.** Nothing here measures or
 * animates layout; the content simply replaces the skeleton in the flow at the
 * moment the dissolve begins, so a skeleton of another height moves everything
 * below it once. That is the caller's to get right (`StatTile`, `ListRow` and
 * the `skeletons/` folder each size theirs to the thing they stand in for),
 * and it is why this is opacity and nothing else — no `LayoutAnimation`, no
 * Reanimated `LinearTransition` (which is also unsafe on a recycled row on the
 * Reanimated this app ships).
 *
 * RN's `Animated` with the native driver, like `Skeleton` itself: an opacity
 * needs nothing from the JS thread.
 *
 * Content that is there on the first render — a screen restored from the
 * persisted cache — never animates: there was no skeleton to leave. With
 * reduced motion on, content simply replaces the skeleton.
 */
export function CrossFade({
  ready,
  skeleton,
  children,
  style,
}: {
  ready: boolean
  skeleton: ReactNode
  /** Not rendered while `ready` is false, so it may read data that is not there yet. */
  children: ReactNode
  /** Layout for the slot itself, in every phase. */
  style?: StyleProp<ViewStyle>
}) {
  const reduceMotion = useReduceMotion()
  const styles = useStyles()
  // 0 is all skeleton, 1 is all content.
  const progress = useRef(new Animated.Value(ready ? 1 : 0)).current
  const contentShown = useRef(ready)
  // True while both layers are drawn.
  const [fading, setFading] = useState(false)

  /*
   * A layout effect, not an effect: the render in which `ready` turns true
   * has no skeleton left to draw and its content is still at opacity 0, and
   * an effect would let that one frame reach the screen. This one sets
   * `fading` before anything is painted.
   */
  useLayoutEffect(() => {
    if (!ready) {
      contentShown.current = false
      progress.setValue(0)
      setFading(false)
      return
    }
    if (contentShown.current || reduceMotion) {
      contentShown.current = true
      progress.setValue(1)
      setFading(false)
      return
    }
    contentShown.current = true
    setFading(true)
    const fade = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION,
      easing: EASE_OUT,
      useNativeDriver: true,
    })
    fade.start(() => setFading(false))
    return () => fade.stop()
  }, [ready, reduceMotion, progress])

  const skeletonOpacity = useMemo(
    () => progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    [progress],
  )

  return (
    // Clipped while both are drawn, so a skeleton taller than the content
    // cannot reach over what sits below it.
    <View style={[style, fading && styles.clip]}>
      {ready ? <Animated.View style={{ opacity: progress }}>{children}</Animated.View> : null}
      {!ready || fading ? (
        <Animated.View
          pointerEvents="none"
          style={[ready && styles.overlay, { opacity: skeletonOpacity }]}
        >
          {skeleton}
        </Animated.View>
      ) : null}
    </View>
  )
}

const useStyles = makeStyles(() => ({
  clip: { overflow: 'hidden' },
  // Logical edges: the skeleton starts where the content starts, in RTL too.
  overlay: { end: 0, position: 'absolute', start: 0, top: 0 },
}))
