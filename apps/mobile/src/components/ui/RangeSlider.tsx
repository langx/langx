import { useRef, useState } from 'react'
import { PanResponder, Text, View } from 'react-native'
import { useV3Home } from '../../hooks/useV3Home'
import { useLocale } from '../../i18n'
import { makeStyles } from '../../lib/theme'

interface RangeSliderProps {
  min: number
  max: number
  /** Inclusive pair, always `low <= high`. */
  values: readonly [number, number]
  onChange: (values: [number, number]) => void
  accessibilityLabel: string
  /**
   * The words under each end of the track — "18", "55+". Drawn by the
   * redesign's look only (V-Filters); the current look has none.
   */
  scaleLabels?: readonly [string, string]
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
export function RangeSlider({
  min,
  max,
  values,
  onChange,
  accessibilityLabel,
  scaleLabels,
}: RangeSliderProps) {
  const legacyStyles = useStyles()
  const v3Styles = useStylesV3()
  const v3Look = useV3Home()
  const { isRtl } = useLocale()
  const [trackWidth, setTrackWidth] = useState(0)

  /*
   * The redesign runs the track from the reading start (V-Filters: "the age
   * slider runs right to left" in RTL), so its thumbs sit at `start` and a
   * drag towards the start lowers the value whichever side that is. The
   * current look stays on `left`, as it always has.
   */
  const direction = v3Look && isRtl ? -1 : 1

  // Refs mirror props so the responders — created once — read current state.
  const state = useRef({ values, min, max, trackWidth, onChange, direction })
  state.current = { values, min, max, trackWidth, onChange, direction }

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
          direction: sign,
        } = state.current
        if (width <= 0) return
        const perPixel = (hi - lo) / width
        const raw = dragStart.current[thumb] + sign * gesture.dx * perPixel
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

  if (v3Look) {
    const styles = v3Styles
    return (
      <View style={styles.root}>
        <View
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={accessibilityLabel}
          accessibilityValue={{ min, max, text: `${values[0]}–${values[1]}` }}
          style={styles.slider}
        >
          <View style={styles.track} onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
            <View style={[styles.fill, { start: `${lowPct}%`, width: `${highPct - lowPct}%` }]} />
          </View>
          <View
            style={[styles.thumb, { start: (lowPct / 100) * trackWidth }]}
            {...lowResponder.panHandlers}
          >
            <View style={styles.knob}>
              <View style={styles.knobCore} />
            </View>
          </View>
          <View
            style={[styles.thumb, { start: (highPct / 100) * trackWidth }]}
            {...highResponder.panHandlers}
          >
            <View style={styles.knob}>
              <View style={styles.knobCore} />
            </View>
          </View>
        </View>
        {scaleLabels ? (
          <View style={styles.scale} importantForAccessibility="no-hide-descendants">
            <Text style={styles.scaleLabel}>{scaleLabels[0]}</Text>
            <Text style={styles.scaleLabel}>{scaleLabels[1]}</Text>
          </View>
        ) : null}
      </View>
    )
  }

  const styles = legacyStyles
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

/** Thumb's touch target: the drawing's 44pt square around a 30pt knob. */
const V3_TARGET = 44

const useStylesV3 = makeStyles(({ v3 }) => ({
  root: { gap: v3.space[4] },
  slider: { height: V3_TARGET, justifyContent: 'center' },
  /*
   * The track is inset by half a target at each end — the drawing's
   * `margin: 0 22px` — and the thumbs are placed in points along it rather
   * than by percentage of an inset box. A thumb at either end then keeps its
   * whole 44pt square inside the slider's own frame, which matters because
   * Android does not hit-test a child outside its parent's bounds.
   */
  track: {
    backgroundColor: v3.colors.line,
    borderRadius: v3.radius.pill,
    height: 10,
    marginHorizontal: V3_TARGET / 2,
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: v3.colors.fg,
    borderRadius: v3.radius.pill,
    bottom: 0,
    position: 'absolute',
    top: 0,
  },
  thumb: {
    alignItems: 'center',
    height: V3_TARGET,
    justifyContent: 'center',
    position: 'absolute',
    top: 0,
    width: V3_TARGET,
  },
  /*
   * The ink knob with a ring of the ground and an ink edge outside it: flat,
   * no shadow, and it reads on the ink fill as well as on the grey track.
   * The drawing's 2pt outline is this view's own ink fill showing round the
   * ring, since `outline` is not drawn on every platform this app runs on.
   */
  knob: {
    alignItems: 'center',
    backgroundColor: v3.colors.fg,
    borderRadius: v3.radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  knobCore: {
    backgroundColor: v3.colors.pill,
    borderColor: v3.colors.bg,
    borderRadius: v3.radius.pill,
    borderWidth: 3,
    height: 30,
    width: 30,
  },
  scale: { flexDirection: 'row', justifyContent: 'space-between' },
  scaleLabel: { ...v3.type.caption, color: v3.colors.muted },
}))
