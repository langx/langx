import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { patchOutline } from '../../lib/badgePatch/geometry'
import { EASE_OUT } from '../../lib/theme/motion'
import { BadgePatch } from './BadgePatch'

const AnimatedPath = Animated.createAnimatedComponent(Path)

/** Once round the border. */
const STITCH_MS = 900
/** Reduce motion: the finished patch, faded in. */
const FADE_MS = 150

/**
 * The earned moment: a needle stitches the patch's border once, 900 ms, ease
 * out, and the thread settles into the band that was already there. With
 * reduced motion the finished patch fades in over 150 ms instead.
 *
 * Plays when it mounts; the caller decides whether this is the first time the
 * id has been seen (`useNewBadges`), so it plays once per badge.
 */
export function BadgeStitch({ id, size }: { id: string; size: number }) {
  const reduce = useReduceMotion()
  const outline = patchOutline(id)
  const length = outline?.length ?? 0
  const drawn = useSharedValue(reduce ? 1 : 0)
  const shown = useSharedValue(reduce ? 0 : 1)

  useEffect(() => {
    if (reduce) {
      drawn.set(1)
      shown.set(withTiming(1, { duration: FADE_MS }))
      return
    }
    drawn.set(withTiming(1, { duration: STITCH_MS, easing: EASE_OUT }))
  }, [reduce, drawn, shown])

  const thread = useAnimatedProps(() => ({
    strokeDashoffset: length * (1 - drawn.get()),
    // Once round, the thread gives way to the band sewn underneath it.
    strokeOpacity: drawn.get() >= 1 ? 0 : 1,
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
              animatedProps={thread}
            />
          </Svg>
        </Animated.View>
      ) : null}
    </View>
  )
}
