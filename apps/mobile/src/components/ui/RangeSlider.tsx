import { useRef, useState } from 'react'
import { PanResponder, View } from 'react-native'
import { makeStyles } from '../../lib/theme'

interface RangeSliderProps {
  min: number
  max: number
  /** Inclusive pair, always `low <= high`. */
  values: readonly [number, number]
  onChange: (values: [number, number]) => void
  accessibilityLabel: string
}

/**
 * v3's two-handled slider — the age filter. Whole-number steps, because every
 * range this app asks for is one (years of age, kilometres).
 *
 * Hand-rolled on `PanResponder` rather than a slider dependency: RN ships no
 * two-thumb slider, the community ones pull in gesture-handler, and this is
 * forty lines of arithmetic. Each thumb owns its own responder, so a drag that
 * starts on the low thumb can never seize the high one — they only meet, never
 * cross: each is clamped at the other's current value.
 */
export function RangeSlider({ min, max, values, onChange, accessibilityLabel }: RangeSliderProps) {
  const styles = useStyles()
  const [trackWidth, setTrackWidth] = useState(0)

  // Refs mirror props so the responders — created once — read current state.
  const state = useRef({ values, min, max, trackWidth, onChange })
  state.current = { values, min, max, trackWidth, onChange }

  // The value a thumb had when its drag began; deltas apply against this.
  const dragStart = useRef<[number, number]>([values[0], values[1]])

  function makeResponder(thumb: 0 | 1) {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragStart.current = [state.current.values[0], state.current.values[1]]
      },
      onPanResponderMove: (_event, gesture) => {
        const {
          min: lo,
          max: hi,
          trackWidth: width,
          values: current,
          onChange: emit,
        } = state.current
        if (width <= 0) return
        const perPixel = (hi - lo) / width
        const raw = dragStart.current[thumb] + gesture.dx * perPixel
        const stepped = Math.round(Math.min(hi, Math.max(lo, raw)))
        const next: [number, number] =
          thumb === 0
            ? [Math.min(stepped, current[1]), current[1]]
            : [current[0], Math.max(stepped, current[0])]
        if (next[0] !== current[0] || next[1] !== current[1]) emit(next)
      },
    })
  }

  const lowResponder = useRef(makeResponder(0)).current
  const highResponder = useRef(makeResponder(1)).current

  const span = max - min
  const lowPct = span > 0 ? ((values[0] - min) / span) * 100 : 0
  const highPct = span > 0 ? ((values[1] - min) / span) * 100 : 100

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, text: `${values[0]}–${values[1]}` }}
      style={styles.root}
    >
      <View style={styles.track} onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
        <View style={[styles.fill, { left: `${lowPct}%`, width: `${highPct - lowPct}%` }]} />
      </View>
      <View
        style={[styles.thumb, { left: `${lowPct}%` }]}
        hitSlop={14}
        {...lowResponder.panHandlers}
      />
      <View
        style={[styles.thumb, { left: `${highPct}%` }]}
        hitSlop={14}
        {...highResponder.panHandlers}
      />
    </View>
  )
}

const useStyles = makeStyles(({ colors, radius }) => ({
  // Tall enough that the thumbs' touch targets live inside the layout box —
  // an absolutely-positioned thumb poking out of a 4px-high view is
  // untappable on Android, which clips touches to bounds.
  root: { height: 40, justifyContent: 'center' },
  track: {
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    height: 4,
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    bottom: 0,
    position: 'absolute',
    top: 0,
  },
  thumb: {
    backgroundColor: colors.knob,
    borderColor: colors.accent,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 22,
    marginLeft: -11,
    position: 'absolute',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
    top: 9,
    width: 22,
  },
}))
