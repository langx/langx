import { useIsFocused } from 'expo-router'
import { useEffect, useState, type ReactNode } from 'react'
import { AppState, StyleSheet } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { useReduceMotion } from '../../hooks/useReduceMotion'

/** One pass round the glass. */
const SWEEP_MS = 6000
/** One pass at most every this often: the pass, then the rest of the period still. */
const PERIOD_MS = 20_000

/**
 * Aurora Glass's light sweep: the highlight drawn at 30° travels once round
 * the outer glass, then rests where it started until twenty seconds have
 * passed. The only frame that moves.
 *
 * Passed to `Avatar` as `sweep` by the places it runs — the Me hero, the
 * profile screen when it is your own, and a frame's sheet in the redesign's
 * store (`FrameDetailSheet`) — and nowhere else, so a list of
 * other people never animates. Under reduce motion it does not move at all: the highlight rests
 * at 30°, which is the still drawing. It pauses while its screen is not
 * focused or the app is in the background, and starts again from rest.
 *
 * A rotation of the view the highlight is drawn in, on the UI thread. The
 * highlight's view is the drawing's own box, so its centre is the ring's.
 */
export function FrameSweep({ box, children }: { box: number; children: ReactNode }) {
  const reduce = useReduceMotion()
  const focused = useIsFocused()
  const [active, setActive] = useState(AppState.currentState === 'active')
  const turn = useSharedValue(0)

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => setActive(next === 'active'))
    return () => subscription.remove()
  }, [])

  const running = !reduce && focused && active
  useEffect(() => {
    if (!running) {
      cancelAnimation(turn)
      turn.set(0)
      return
    }
    // A full turn back to where it rests, then a jump from 360 to 0 that
    // draws nothing new, held for the rest of the period.
    turn.set(
      withRepeat(
        withSequence(
          withTiming(360, { duration: SWEEP_MS, easing: Easing.inOut(Easing.quad) }),
          withDelay(PERIOD_MS - SWEEP_MS, withTiming(0, { duration: 0 })),
        ),
        -1,
      ),
    )
    return () => cancelAnimation(turn)
  }, [running, turn])

  const style = useAnimatedStyle(() => {
    'worklet'
    return { transform: [{ rotate: `${turn.get()}deg` }] }
  })

  return (
    <Animated.View pointerEvents="none" style={[styles.layer, { height: box, width: box }, style]}>
      {children}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, start: 0 },
})
