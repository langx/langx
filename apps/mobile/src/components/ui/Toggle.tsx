import { useEffect } from 'react'
import { ActivityIndicator, Platform, Pressable } from 'react-native'
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { useChangeHaptic } from '../../hooks/useChangeHaptic'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useLocale } from '../../i18n'
import { makeStyles, useTheme } from '../../lib/theme'
import { SPRING, unlessReduced } from '../../lib/theme/motion'

interface ToggleProps {
  value: boolean
  onValueChange: (next: boolean) => void
  disabled?: boolean
  /**
   * The change is on its way to the server. The knob becomes a spinner and
   * presses are ignored until it lands: a privacy switch is the one control
   * where a request that silently takes three seconds reads as a switch that
   * did nothing, and a second tap then undoes the first.
   */
  busy?: boolean
  accessibilityLabel: string
}

/** v3's switch, as the settings drawings draw it: 54 by 32 with a 2pt edge. */
const TRACK_WIDTH = 54
const TRACK_HEIGHT = 32
const EDGE = 2
const KNOB = 22
/** Round the on knob, inside the edge: (32 − 2 × 2 − 22) / 2. */
const INSET = (TRACK_HEIGHT - 2 * EDGE - KNOB) / 2
/** From the off position to the on one. */
const TRAVEL = TRACK_WIDTH - 2 * EDGE - 2 * INSET - KNOB
/**
 * Off, the knob shrinks to 16 — the drawings mark "off" by size as well as
 * colour, so it reads without telling grey from blue. Scaled from its centre,
 * it keeps the same 6pt on every side that the on knob keeps 3.
 */
const KNOB_OFF_SCALE = 16 / KNOB
/**
 * Around the 32pt track to the platform's minimum target — 44pt on iOS, 48dp
 * on Android — and to 60 across, as drawn. Slop rather than a bigger box, so
 * no row a switch sits in changes height.
 */
const SLOP = {
  vertical: (Platform.select({ android: 48, default: 44 }) - TRACK_HEIGHT) / 2,
  horizontal: (60 - TRACK_WIDTH) / 2,
}

/**
 * Not RN's `Switch`: that renders the platform control, which ignores the
 * palette and looks like a different app's widget dropped into the row.
 *
 * v3's switch: on is a blue pill with a white knob at the end; off is an
 * outline in the muted ink with a smaller knob of the same ink at the start.
 * Blue rather than yellow, because a setting chooses and yellow is the one
 * committing action on a screen.
 *
 * The knob springs across with a little overshoot — a choice landing, the
 * motion module's `select` — and the colours follow it. On Reanimated: the
 * switch is drawn on settings screens and the filters, none of them on the
 * launch path. Under reduce motion it is simply in its new place. One
 * selection tick, through `useChangeHaptic`, when the value actually changes
 * after a press.
 */
export function Toggle({
  value,
  onValueChange,
  disabled = false,
  busy = false,
  accessibilityLabel,
}: ToggleProps) {
  const { v3 } = useTheme()
  const styles = useStyles()
  const reduce = useReduceMotion()
  const { isRtl } = useLocale()
  const markPress = useChangeHaptic(value ? 'on' : 'off')

  const on = useSharedValue(value ? 1 : 0)
  useEffect(() => {
    on.set(unlessReduced(reduce, value ? 1 : 0, (to) => withSpring(to, SPRING.select)))
  }, [on, reduce, value])

  // A translation is physical, so it is turned round for a right-to-left
  // layout, where the knob starts at the right.
  const travel = isRtl ? -TRAVEL : TRAVEL
  const { blue, muted, onBlue } = v3.colors
  const edgeStyle = useAnimatedStyle(
    () => ({ borderColor: interpolateColor(on.get(), [0, 1], [muted, blue]) }),
    [muted, blue],
  )
  // A layer rather than the track's own colour, so off stays see-through
  // without writing out a transparent blue.
  const fillStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, on.get())) }))
  const knobStyle = useAnimatedStyle(
    () => ({
      backgroundColor: interpolateColor(on.get(), [0, 1], [muted, onBlue]),
      transform: [
        { translateX: on.get() * travel },
        // A spinner needs the whole knob, on or off.
        { scale: busy ? 1 : KNOB_OFF_SCALE + (1 - KNOB_OFF_SCALE) * on.get() },
      ],
    }),
    [muted, onBlue, travel, busy],
  )

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: disabled || busy, busy }}
      // react-native-web does not map `checked` out of `accessibilityState`
      // (see `Chip`), so on web every switch was announced without its state.
      aria-checked={value}
      accessibilityLabel={accessibilityLabel}
      disabled={disabled || busy}
      hitSlop={{
        top: SLOP.vertical,
        bottom: SLOP.vertical,
        left: SLOP.horizontal,
        right: SLOP.horizontal,
      }}
      onPress={() => {
        markPress()
        onValueChange(!value)
      }}
      style={disabled ? styles.disabled : null}
    >
      {/* Real views from the first render, transform and all, for the Fabric
          reason `PressableScale` gives. */}
      <Animated.View collapsable={false} style={[styles.track, edgeStyle]}>
        <Animated.View collapsable={false} style={[styles.fill, fillStyle]} />
        <Animated.View collapsable={false} style={[styles.knob, knobStyle]}>
          {busy ? (
            <ActivityIndicator
              size="small"
              color={value ? blue : v3.colors.bg}
              style={styles.spinner}
            />
          ) : null}
        </Animated.View>
      </Animated.View>
    </Pressable>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  track: {
    borderRadius: v3.radius.pill,
    borderWidth: EDGE,
    flexDirection: 'row',
    height: TRACK_HEIGHT,
    paddingHorizontal: INSET,
    paddingVertical: INSET,
    width: TRACK_WIDTH,
  },
  fill: {
    backgroundColor: v3.colors.blue,
    borderRadius: v3.radius.pill,
    bottom: 0,
    end: 0,
    position: 'absolute',
    start: 0,
    top: 0,
  },
  knob: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    height: KNOB,
    justifyContent: 'center',
    width: KNOB,
  },
  disabled: { opacity: 0.5 },
  // RN's "small" indicator is 20px; scaled so it sits inside the knob with a
  // hairline round it rather than touching the edge.
  spinner: { transform: [{ scale: 0.8 }] },
}))
