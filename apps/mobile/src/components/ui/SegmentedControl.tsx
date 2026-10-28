import { useLayoutEffect, useRef, useState } from 'react'
import {
  Animated,
  Platform,
  Pressable,
  Text,
  View,
  type LayoutChangeEvent,
  type LayoutRectangle,
} from 'react-native'
import { useChangeHaptic } from '../../hooks/useChangeHaptic'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { makeStyles, useTheme, type V3Tokens } from '../../lib/theme'
import { EASE_OUT } from '../../lib/theme/motionAnimated'
import { DURATION } from '../../lib/theme/motionValues'

interface SegmentedControlProps<T extends string> {
  options: readonly { value: T; label: string }[]
  /** Kept as a set for callers whose choice genuinely is one — see filters. */
  selected: readonly T[]
  onToggle: (value: T) => void
  accessibilityLabel: string
}

/** Each segment is a whole target: 44pt on iOS, 48dp on Android. */
const SEGMENT_HEIGHT = Platform.select({ android: 48, default: 44 })

/**
 * How far a label may shrink to fit before it truncates instead. A German or
 * Russian label is often a word too long for a third of a phone.
 */
const MIN_FONT_SCALE = 0.8

/**
 * A segment's inset on each side, as a step of `v3.space`: the room a label
 * has is the segment's width less two of these.
 */
const SEGMENT_INSET = 6 satisfies keyof V3Tokens['space']

/**
 * A fitted size is rounded down to a tenth of a point, so a label sized to the
 * exact room is never cut to an ellipsis by a rounding.
 */
const FIT_STEP = 10

type Size = { width: number; height: number }

/**
 * v3's segmented control: the grey `surface` block with the chosen segment as
 * an ink pill inside it, labels in Nunito. It chooses rather than commits, so
 * no yellow anywhere near it.
 *
 * The pill slides to a new choice. It carries a white copy of every label,
 * moved against it so each sits exactly over its ink original, and clips it
 * to its own shape — so a label is white precisely where the pill covers it,
 * mid-slide too. Changing a label's colour at the tap instead left it white
 * on the grey until the pill arrived. Under reduce motion the pill is simply
 * there.
 *
 * On React Native's `Animated`, with the native driver: the onboarding steps
 * draw this, and the launch path stays off Reanimated (_The row swipe runs on
 * the UI thread_). The native driver also keeps the slide smooth while the
 * screen underneath re-renders for the new choice, which the language step
 * does wholesale — it remounts the picker.
 *
 * Where more than one segment is chosen — the filters' level band — there is
 * nothing to slide, and each chosen segment is its own pill, as drawn. Until
 * the control has been measured the chosen one is drawn the same way, so the
 * first frame is already right.
 */
export function SegmentedControl<T extends string>({
  options,
  selected,
  onToggle,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const reduce = useReduceMotion()
  const markPress = useChangeHaptic(selected.join('\n'))
  const index = selected.length === 1 ? options.findIndex((o) => o.value === selected[0]) : -1
  // Two or three segments take the drawings' 16pt; four or more have a
  // quarter of a phone each, and a word like "Non-binary" only fits that at
  // the label step.
  const compact = options.length > 3
  const label = compact ? styles.labelCompact : styles.label

  const [track, setTrack] = useState<Size | null>(null)
  const [frames, setFrames] = useState<Record<number, LayoutRectangle>>({})
  const first = frames[0]
  const measured = track !== null && options.every((_, at) => frames[at] !== undefined)
  const sliding = index >= 0 && measured && first !== undefined

  /*
   * The web build has no `adjustsFontSizeToFit`: react-native-web drops it,
   * and a label too long for its segment was cut to an ellipsis at full size
   * while the phones shrank the same word to fit — "Correcciones" and
   * "Исправления" on Transparency's chart. So on the web each label is drawn
   * once more, unseen and unwrapped, its width taken, and its size set to
   * what fits the segment, down to the same floor. A label that fits keeps
   * its size exactly.
   */
  const fitOnWeb = Platform.OS === 'web'
  const [natural, setNatural] = useState<Readonly<Record<string, number>>>({})
  const baseSize = (compact ? v3.type.label : v3.type.buttonSmall).fontSize
  const fitted = (at: number) => {
    const option = options[at]
    const width = option === undefined ? undefined : natural[option.label]
    const frame = frames[at]
    if (!fitOnWeb || width === undefined || frame === undefined || width <= 0) return null
    const room = frame.width - 2 * v3.space[SEGMENT_INSET]
    if (width <= room) return null
    const scale = Math.max(MIN_FONT_SCALE, room / width)
    return { fontSize: Math.floor(baseSize * scale * FIT_STEP) / FIT_STEP }
  }
  const onNatural = (text: string) => (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout
    setNatural((current) => (current[text] === width ? current : { ...current, [text]: width }))
  }

  /** The chosen segment's index, as a number that can be between two. */
  const position = useRef(new Animated.Value(Math.max(0, index))).current
  /** Where the pill was last sent; `null` while there is no pill to slide. */
  const placed = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (!sliding) {
      placed.current = null
      return
    }
    // Arriving — first measure, or back from a band — it is put, not slid,
    // and before the frame is drawn (a layout effect), so the pill does not
    // show for a frame wherever it was left.
    if (placed.current === null || reduce) {
      placed.current = index
      position.setValue(index)
      return
    }
    if (placed.current === index) return
    placed.current = index
    const slide = Animated.timing(position, {
      toValue: index,
      duration: DURATION.enter,
      easing: EASE_OUT,
      useNativeDriver: true,
    })
    slide.start()
    return () => slide.stop()
  }, [index, position, reduce, sliding])

  const onTrackLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    setTrack((was) => (was?.width === width && was.height === height ? was : { width, height }))
  }
  const onSegmentLayout = (at: number) => (event: LayoutChangeEvent) => {
    const frame = event.nativeEvent.layout
    setFrames((current) => {
      const was = current[at]
      if (was && was.x === frame.x && was.width === frame.width && was.height === frame.height) {
        return current
      }
      return { ...current, [at]: frame }
    })
  }

  let pill = null
  if (sliding && track) {
    // The pill is anchored at the first segment's place, at the logical
    // start, and moved by how far each segment sits from that one. Measured
    // layout and a translation are both physical, so a right-to-left layout
    // needs no turning round.
    const steps = options.map((_, at) => at)
    const slide =
      steps.length > 1
        ? position.interpolate({
            inputRange: steps,
            outputRange: steps.map((at) => (frames[at]?.x ?? first.x) - first.x),
          })
        : new Animated.Value(0)
    pill = (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.pill,
          {
            height: first.height,
            width: frames[index]?.width ?? first.width,
            transform: [{ translateX: slide }],
          },
        ]}
      >
        {/* The white labels: the track's own row, laid where the track is and
            moved back by as much as the pill moves forward. */}
        <Animated.View
          aria-hidden
          style={[
            styles.mirror,
            track,
            { transform: [{ translateX: Animated.multiply(slide, -1) }] },
          ]}
        >
          {options.map((option, at) => (
            <View key={option.value} style={styles.segment}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={MIN_FONT_SCALE}
                style={[label, styles.labelOn, fitted(at)]}
              >
                {option.label}
              </Text>
            </View>
          ))}
        </Animated.View>
      </Animated.View>
    )
  }

  return (
    <View
      style={styles.track}
      onLayout={onTrackLayout}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((option, at) => {
        const on = selected.includes(option.value)
        // Drawn as its own pill only when there is no sliding one to stand
        // in for it — a band, or before the first measure.
        const ownPill = on && !sliding
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={option.label}
            onLayout={onSegmentLayout(at)}
            onPress={() => {
              markPress()
              onToggle(option.value)
            }}
            style={({ pressed }) => [
              styles.segment,
              ownPill && styles.segmentOn,
              pressed && !on && styles.pressed,
            ]}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={MIN_FONT_SCALE}
              style={[label, ownPill ? styles.labelOn : styles.labelOff, fitted(at)]}
            >
              {option.label}
            </Text>
          </Pressable>
        )
      })}
      {fitOnWeb ? (
        // Out of the layout and unseen; each label hugs its own width. As wide
        // as the track allows, which is more than any segment has, so a label
        // that would wrap here is past the floor anyway.
        <View style={styles.measure} aria-hidden>
          {options.map((option) => (
            <View key={option.value} style={styles.measured} onLayout={onNatural(option.label)}>
              <Text style={label}>{option.label}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {/* After the segments, so it covers the label under it; it takes no
          touches, so the segment under it still does. */}
      {pill}
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  track: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[4],
    padding: v3.space[4],
  },
  segment: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    flex: 1,
    justifyContent: 'center',
    minHeight: SEGMENT_HEIGHT,
    paddingHorizontal: v3.space[SEGMENT_INSET],
  },
  segmentOn: { backgroundColor: v3.colors.pill },
  pill: {
    backgroundColor: v3.colors.pill,
    borderRadius: v3.radius.pill,
    overflow: 'hidden',
    position: 'absolute',
    start: v3.space[4],
    top: v3.space[4],
  },
  // The track's row again, from the track's own corner: the pill sits the
  // track's padding in from it.
  mirror: {
    flexDirection: 'row',
    gap: v3.space[4],
    padding: v3.space[4],
    position: 'absolute',
    start: -v3.space[4],
    top: -v3.space[4],
  },
  measure: {
    alignItems: 'flex-start',
    opacity: 0,
    pointerEvents: 'none',
    position: 'absolute',
    start: 0,
    top: 0,
  },
  measured: { alignSelf: 'flex-start' },
  pressed: { opacity: 0.6 },
  label: { ...v3.type.buttonSmall, textAlign: 'center' },
  labelCompact: { ...v3.type.label, textAlign: 'center' },
  labelOff: { color: v3.colors.fg },
  labelOn: { color: v3.colors.pillText },
}))
