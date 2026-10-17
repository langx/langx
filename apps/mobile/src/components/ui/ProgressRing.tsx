import { useEffect, useRef, type ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { useAnimatedProps, useSharedValue, withSpring } from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { arcOffset, clampProgress, ringGeometry } from '../../lib/ringProgress'
import { makeStyles, useTheme } from '../../lib/theme'
import { SPRING, unlessReduced } from '../../lib/theme/motion'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/**
 * The drawings' three rings. `sm` sits at the start of a row (Echo's "Today's
 * three · 2 of 3"), `md` is one of Home's three, `lg` the first week's.
 */
const SIZES = {
  sm: { size: 44, stroke: 6 },
  md: { size: 58, stroke: 8 },
  lg: { size: 84, stroke: 10 },
} as const

interface ProgressRingProps {
  /** 0 to 1. Anything outside is clamped — see `lib/ringProgress.ts`. */
  progress: number
  /** The arc's colour, which is what the ring is about: green for done, a hue for a goal. */
  color: string
  /** The unfilled part. `track` by default; Echo's ring runs on Echo's tint. */
  trackColor?: string
  size?: keyof typeof SIZES
  /** Drawn in the middle, upright: a glyph, or "1/4". */
  children?: ReactNode
  /**
   * What the ring says, when it is the only thing saying it — the first
   * week's "1 of 4 done". Left out where a label beside the ring already
   * says it, as on Home, and the ring is then hidden from screen readers
   * rather than read twice.
   */
  accessibilityLabel?: string
}

/**
 * A ring that fills clockwise from twelve o'clock, on the UI thread.
 *
 * **It moves only when its progress changes in front of the person.** On
 * mount it is simply at its value: Home is opened many times a day, and
 * three rings refilling from empty on every visit would be a celebration of
 * nothing. A ring that closes while the screen is up — the third of today's
 * three done — eases there with `SPRING.settle`, and with reduced motion is
 * at the new value at once.
 *
 * Clockwise in every locale. A progress ring is a dial, not a line of text,
 * and right-to-left readers know a filling ring by the same sweep (the
 * platforms' own activity rings do not turn round either); the SVG is not
 * mirrored by the layout, so this is also simply what it does.
 */
export function ProgressRing({
  progress,
  color,
  trackColor,
  size = 'md',
  children,
  accessibilityLabel,
}: ProgressRingProps) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const reduce = useReduceMotion()
  const { size: box, stroke } = SIZES[size]
  const { centre, radius, circumference } = ringGeometry(box, stroke)
  const target = clampProgress(progress)

  const fill = useSharedValue(target)
  const mounted = useRef(false)
  useEffect(() => {
    // The first run is the mount, where the value is already right.
    if (!mounted.current) {
      mounted.current = true
      return
    }
    fill.set(unlessReduced(reduce, target, (to) => withSpring(to, SPRING.settle)))
  }, [target, reduce, fill])

  const arc = useAnimatedProps(() => ({
    strokeDashoffset: arcOffset(circumference, fill.get()),
    // An empty arc with round caps still paints a dot of cap at twelve, so
    // nothing is drawn until there is something to draw.
    strokeOpacity: fill.get() > 0 ? 1 : 0,
  }))

  return (
    <View
      {...(accessibilityLabel
        ? {
            accessible: true,
            accessibilityRole: 'progressbar' as const,
            accessibilityLabel,
            accessibilityValue: { min: 0, max: 100, now: Math.round(target * 100) },
          }
        : {
            accessibilityElementsHidden: true,
            importantForAccessibility: 'no-hide-descendants' as const,
          })}
      style={{ height: box, width: box }}
    >
      {/* Turned a quarter back, so the arc starts at twelve rather than at
          three, where SVG begins a circle. The middle is not turned. */}
      <View style={[StyleSheet.absoluteFill, styles.turned]}>
        <Svg width={box} height={box}>
          <Circle
            cx={centre}
            cy={centre}
            r={radius}
            stroke={trackColor ?? v3.colors.track}
            strokeWidth={stroke}
            fill="none"
          />
          <AnimatedCircle
            cx={centre}
            cy={centre}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            fill="none"
            animatedProps={arc}
          />
        </Svg>
      </View>
      <View style={styles.middle}>{children}</View>
    </View>
  )
}

const useStyles = makeStyles(() => ({
  turned: { transform: [{ rotate: '-90deg' }] },
  middle: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
}))
