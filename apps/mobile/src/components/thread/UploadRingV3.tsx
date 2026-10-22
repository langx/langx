import { useEffect } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { makeStyles, useTheme } from '../../lib/theme'
import { LOOP, TIMING, unlessReduced } from '../../lib/theme/motion'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/** The disc, its ink ring included. */
const SIZE = 56
const RING = 2
/** The arc's box, inside the ring with a little ground showing between them. */
const ARC_BOX = SIZE - RING * 2 - 6
const STROKE = 4
const RADIUS = (ARC_BOX - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
/** What an upload with no number yet draws: a short arc, going round. */
const PENDING_ARC = 0.25

/**
 * The v3 look's upload ring, laid on a picture on its way up: a disc of the
 * ground with an ink ring round it, like every other v3 control that sits on
 * something busy, and inside it your blue filling a grey track, with the
 * number in v3's label face.
 *
 * Determinate and still while there is a number: the arc grows to each new
 * value over `TIMING.fill`, on the UI thread, and does not turn — a turning
 * arc says "busy", and this one can say how far. Only while the file is still
 * being read, when there is no number to give (`fraction` null), does a
 * quarter arc go round, at the spinner's own pace. With reduced motion it
 * neither eases nor turns.
 */
export function UploadRingV3({ fraction, label }: { fraction: number | null; label: string }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const reduceMotion = useReduceMotion()
  const waiting = fraction === null

  const fill = useSharedValue(fraction ?? PENDING_ARC)
  useEffect(() => {
    // A sliver at the start, so 0% is still visibly a ring that has begun.
    const target = fraction === null ? PENDING_ARC : Math.max(0.02, fraction)
    fill.set(unlessReduced(reduceMotion, target, (to) => withTiming(to, TIMING.fill)))
  }, [fraction, reduceMotion, fill])

  const spin = useSharedValue(0)
  useEffect(() => {
    cancelAnimation(spin)
    spin.set(0)
    if (reduceMotion || !waiting) return
    spin.set(withRepeat(withTiming(1, { duration: LOOP.spin, easing: Easing.linear }), -1, false))
    return () => cancelAnimation(spin)
  }, [reduceMotion, waiting, spin])

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - fill.get()),
  }))
  const spinStyle = useAnimatedStyle(() => ({
    // Less a quarter turn, so the arc starts at twelve o'clock rather than at
    // three, which is where SVG begins a circle.
    transform: [{ rotate: `${spin.get() * 360 - 90}deg` }],
  }))

  return (
    <View style={styles.disc}>
      <Animated.View style={[styles.arc, spinStyle]}>
        <Svg width={ARC_BOX} height={ARC_BOX}>
          <Circle
            cx={ARC_BOX / 2}
            cy={ARC_BOX / 2}
            r={RADIUS}
            stroke={v3.colors.track}
            strokeWidth={STROKE}
            fill="none"
          />
          <AnimatedCircle
            cx={ARC_BOX / 2}
            cy={ARC_BOX / 2}
            r={RADIUS}
            stroke={v3.colors.blue}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            fill="none"
            animatedProps={arcProps}
          />
        </Svg>
      </Animated.View>
      <Text style={styles.label}>{label}</Text>
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  disc: {
    alignItems: 'center',
    backgroundColor: v3.colors.bg,
    borderColor: v3.colors.fg,
    borderRadius: v3.radius.pill,
    borderWidth: RING,
    height: SIZE,
    justifyContent: 'center',
    width: SIZE,
  },
  arc: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  /*
   * Tabular figures, as everywhere a percentage counts: 9%, 49% and 100% are
   * three widths, and a centred proportional number slides as it counts.
   */
  label: { ...v3.type.label, color: v3.colors.fg, fontVariant: ['tabular-nums'] },
}))
