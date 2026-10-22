import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { patchOutline } from '../../lib/badgePatch/geometry'
import { DELAY, EASE_OUT, TIMING } from '../../lib/theme/motion'
import { BadgePatch } from './BadgePatch'

const AnimatedPath = Animated.createAnimatedComponent(Path)

/** Once round the border. */
const STITCH_MS = 900
/** Reduce motion: the finished patch, faded in. */
const FADE_MS = 150

/**
 * The earned moment: a needle stitches the patch's border once, 900 ms, ease
 * out, and the thread fades into the band that was already there. With
 * reduced motion the finished patch fades in over 150 ms instead.
 *
 * The stitch waits `DELAY.afterPush` first: it lives on a sheet that slides
 * up, and a needle that is half way round before the sheet has landed is half
 * seen. `onStitched` runs when the last stitch is in — the moment the sheet's
 * one haptic belongs to — or once the patch has faded in.
 *
 * Reduce motion is read as it answers, not only at mount: `useReduceMotion`
 * can answer after the first frame, and a stitch already under way then
 * finishes at once rather than playing on.
 *
 * Plays when it mounts; the caller decides whether this is the first time the
 * id has been seen (`useNewBadges`), so it plays once per badge.
 */
export function BadgeStitch({
  id,
  size,
  onStitched,
}: {
  id: string
  size: number
  onStitched?: (() => void) | undefined
}) {
  const reduce = useReduceMotion()
  const outline = patchOutline(id)
  const length = outline?.length ?? 0
  const drawn = useSharedValue(0)
  const thread = useSharedValue(1)
  const shown = useSharedValue(0)

  useEffect(() => {
    const done = (finished?: boolean): void => {
      'worklet'
      if (finished && onStitched) runOnJS(onStitched)()
    }
    if (reduce) {
      cancelAnimation(drawn)
      cancelAnimation(thread)
      drawn.set(1)
      thread.set(0)
      shown.set(withTiming(1, { duration: FADE_MS }, done))
      return
    }
    shown.set(1)
    drawn.set(
      withDelay(DELAY.afterPush, withTiming(1, { duration: STITCH_MS, easing: EASE_OUT }, done)),
    )
    // Once round, the thread gives way to the band sewn underneath it.
    thread.set(withDelay(DELAY.afterPush + STITCH_MS, withTiming(0, TIMING.fade)))
  }, [reduce, drawn, thread, shown, onStitched])

  const threadProps = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - drawn.get()),
    strokeOpacity: thread.get(),
  }))
  const patch = useAnimatedStyle(() => ({ opacity: shown.get() }))

  return (
    <View style={{ height: size, width: size }}>
      <Animated.View style={patch}>
        <BadgePatch id={id} size={size} />
      </Animated.View>
      {outline && !reduce ? (
        <Animated.View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width={size} height={size} viewBox="0 0 64 64">
            <AnimatedPath
              d={outline.d}
              fill="none"
              stroke={outline.color}
              strokeWidth={4.6}
              strokeLinecap="round"
              strokeDasharray={`${length} ${length}`}
              animatedProps={threadProps}
            />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  )
}
