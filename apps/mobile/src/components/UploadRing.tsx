import { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
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
import { useReduceMotion } from '../hooks/useReduceMotion'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

const SIZE = 60
const STROKE = 3
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
/** What an upload with no number yet draws: a short arc, going round. */
const PENDING_ARC = 0.25

/**
 * The ring every messenger draws over a picture on its way up: an arc that
 * fills with the upload, turning slowly so a stalled connection still reads as
 * alive, with the number in the middle.
 *
 * `fraction` is null while there is no number to give — the file is still
 * being read into memory — and the arc is then a fixed quarter rather than a
 * fill that would claim 0%.
 *
 * The arc's growth is eased with `withTiming` because progress events arrive
 * in chunks and would otherwise step. With reduced motion it neither eases nor
 * turns; the fill alone carries the progress.
 */
export function UploadRing({ fraction, label }: { fraction: number | null; label: string }) {
  const reduceMotion = useReduceMotion()

  const fill = useSharedValue(fraction ?? PENDING_ARC)
  useEffect(() => {
    // A sliver at the start, so 0% is still visibly a ring that has begun.
    const target = fraction === null ? PENDING_ARC : Math.max(0.02, fraction)
    fill.value = reduceMotion ? target : withTiming(target, { duration: 220 })
  }, [fraction, reduceMotion, fill])

  const spin = useSharedValue(0)
  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(spin)
      spin.value = 0
      return
    }
    spin.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(spin)
  }, [reduceMotion, spin])

  const arcProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - fill.value),
  }))
  const spinStyle = useAnimatedStyle(() => ({
    // Less a quarter turn, so a still ring starts at twelve o'clock rather
    // than three, which is where SVG begins a circle.
    transform: [{ rotate: `${spin.value * 360 - 90}deg` }],
  }))

  return (
    <View style={styles.badge}>
      <Animated.View style={[StyleSheet.absoluteFill, spinStyle]}>
        <Svg width={SIZE} height={SIZE}>
          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth={STROKE}
            fill="none"
          />
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke="#fff"
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

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: SIZE / 2,
    height: SIZE,
    justifyContent: 'center',
    width: SIZE,
  },
  /*
   * Tabular figures, as in `AttachmentPreview`: 9%, 49% and 100% are three
   * widths, and a centred proportional number slides as it counts.
   */
  label: { color: '#fff', fontSize: 13, fontVariant: ['tabular-nums'], fontWeight: '700' },
})
