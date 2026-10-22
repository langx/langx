import Feather from '@expo/vector-icons/Feather'
import { useEffect, useMemo, useState } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { pendingWaveform } from '../../lib/pendingWaveform'
import { makeStyles, useTheme } from '../../lib/theme'
import { LOOP, TIMING, unlessReduced } from '../../lib/theme/motion'
import { WAVEFORM_BAR_WIDTH, waveformBarCount } from '../../lib/waveform'
import { PLAY_DISC } from '../MediaBubbleV3.styles'

/** Points: `MediaBubble`'s waveform height, so the note does not change size when it lands. */
const HEIGHT = 24
/** How far the not-yet-sent bars fade at the bottom of a breath. */
const BREATH_LOW = 0.45

/**
 * A voice note on its way up, in the v3 thread: the sent note's row — the
 * disc, the bars, a number at the end — so the landing is a change of colour,
 * not of shape. The disc holds a microphone in the line grey rather than a
 * play: nothing here plays yet. The number is the upload's, not a duration.
 * Once it has failed the bars stop breathing and the number goes; what to do
 * about it is the not-sent line under the bubble.
 */
export function PendingVoiceNoteV3({
  seed,
  fraction,
  failed,
  percentLabel,
}: {
  seed: string
  /** Null while the file is still being read and there is no share to show. */
  fraction: number | null
  failed: boolean
  percentLabel: string
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View style={styles.row}>
      <View style={styles.disc}>
        <Feather name="mic" size={v3.icon.sm} color={failed ? v3.colors.muted : v3.colors.fg} />
      </View>
      <PendingWaveformV3 seed={seed} fraction={failed ? null : fraction} breathing={!failed} />
      {failed ? null : <Text style={styles.percent}>{percentLabel}</Text>}
    </View>
  )
}

/**
 * A voice note's bars while it uploads, drawn the way a sent note's are so
 * that the landing is a change of colour, not of shape.
 *
 * Two copies of the same bars. Underneath, every bar in the track grey,
 * breathing slowly — the "pending" part: nothing here is playable yet. Over
 * them, clipped to the share already uploaded, the same bars in your blue.
 * The clip's width follows the upload over `TIMING.fill` on the UI thread, so
 * the edge glides between progress events instead of stepping a bar at a time.
 * While the file is still being read there is no share to show (`fraction`
 * null) and only the breathing grey is drawn. With reduced motion the grey
 * holds still and the blue steps.
 */
function PendingWaveformV3({
  seed,
  fraction,
  breathing = true,
}: {
  seed: string
  fraction: number | null
  /** False once it has failed: nothing is on its way any more. */
  breathing?: boolean
}) {
  const styles = useStyles()
  const reduceMotion = useReduceMotion()
  const [width, setWidth] = useState(0)
  const bars = useMemo(() => pendingWaveform(seed, waveformBarCount(width)), [seed, width])

  const shown = useSharedValue(0)
  useEffect(() => {
    const target = fraction === null ? 0 : Math.min(1, Math.max(0, fraction))
    shown.set(unlessReduced(reduceMotion, target, (to) => withTiming(to, TIMING.fill)))
  }, [fraction, reduceMotion, shown])

  const breath = useSharedValue(1)
  useEffect(() => {
    if (reduceMotion || !breathing) {
      cancelAnimation(breath)
      breath.set(1)
      return
    }
    // Half a breath each way, so one full cycle is `LOOP.breathe`.
    breath.set(
      withRepeat(
        withTiming(BREATH_LOW, { duration: LOOP.breathe / 2, easing: Easing.inOut(Easing.sin) }),
        -1,
        true,
      ),
    )
    return () => cancelAnimation(breath)
  }, [reduceMotion, breathing, breath])

  const restStyle = useAnimatedStyle(() => ({ opacity: breath.get() }))
  const clipStyle = useAnimatedStyle(() => ({ width: shown.get() * width }))

  const row = (style: object) =>
    bars.map((height, index) => (
      <View key={index} style={[styles.bar, style, { height: Math.max(2, height * HEIGHT) }]} />
    ))

  return (
    <View
      style={styles.box}
      onLayout={(event) => setWidth(Math.floor(event.nativeEvent.layout.width))}
    >
      <Animated.View style={[styles.bars, restStyle]}>{row(styles.rest)}</Animated.View>
      {/* `start`, not `left`: in a right-to-left thread the note fills from the right. */}
      <Animated.View style={[styles.clip, clipStyle]} pointerEvents="none">
        <View style={[styles.bars, { width }]}>{row(styles.sent)}</View>
      </Animated.View>
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  // The sent note's row (`MediaBubbleV3.styles`'s `audioRow`), inside the bubble's frame.
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[10],
    minWidth: 200,
    paddingHorizontal: v3.space[6],
    paddingVertical: v3.space[4],
  },
  disc: {
    alignItems: 'center',
    borderColor: v3.colors.line,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    height: PLAY_DISC,
    justifyContent: 'center',
    width: PLAY_DISC,
  },
  percent: {
    ...v3.type.caption,
    color: v3.colors.muted,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    minWidth: 36,
    textAlign: 'right',
  },
  box: { flex: 1, height: HEIGHT, justifyContent: 'center' },
  // `space-between`, as the sent note's: the bars span the row.
  bars: {
    alignItems: 'center',
    flexDirection: 'row',
    height: HEIGHT,
    justifyContent: 'space-between',
  },
  clip: { bottom: 0, overflow: 'hidden', position: 'absolute', start: 0, top: 0 },
  bar: { borderRadius: WAVEFORM_BAR_WIDTH / 2, width: WAVEFORM_BAR_WIDTH },
  rest: { backgroundColor: v3.colors.track },
  sent: { backgroundColor: v3.colors.blue },
}))
