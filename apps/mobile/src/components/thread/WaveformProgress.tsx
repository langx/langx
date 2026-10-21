import { useEffect, useRef } from 'react'
import {
  Animated,
  Easing,
  I18nManager,
  Platform,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useLocale } from '../../i18n'
import { sweepPlan } from '../../lib/waveform'

/**
 * A v3 voice note's bars, with the played part swept in smoothly rather than
 * lit a bar at a time.
 *
 * The bars are drawn twice: faint underneath, and a full-strength copy over
 * them, clipped to the played share. The clip is two opposite translations —
 * the window slides one way and the copy inside it the other, so the copy
 * stands still while the edge moves — which keeps the whole thing a transform
 * on the native driver: no width animates, nothing lays out per frame, and
 * the row it sits in never changes size.
 *
 * RN `Animated` rather than Reanimated, because `MessageMenuHost` — mounted
 * at the root, on the launch path — draws `MediaGallery`, and this file is
 * one import away from it.
 *
 * The edge runs linearly to the end over the real time left (`sweepPlan`),
 * restarted by each status the player reports, so it moves every frame at the
 * speed the note plays. With reduced motion it is set to each status as it
 * arrives instead — the bar still says how far the note has got, in steps.
 */
export function WaveformProgress({
  heights,
  width,
  color,
  rowStyle,
  barStyle,
  fraction,
  playing,
  secondsLeft,
}: {
  /** Each bar's height in points, start to end. */
  heights: readonly number[]
  /** The row's measured width; nothing is clipped until it is known. */
  width: number
  color: string
  /** The row's own layout, so the copy lines up bar for bar with the faint set. */
  rowStyle: StyleProp<ViewStyle>
  barStyle: StyleProp<ViewStyle>
  /** Played share, or `null` for a note of unknown length (nothing played). */
  fraction: number | null
  playing: boolean
  /** Wall-clock seconds to the end, already divided by the playback rate. */
  secondsLeft: number
}) {
  const reduce = useReduceMotion()
  const { isRtl } = useLocale()
  /*
   * Which edge the note starts from. On native the layout follows
   * `I18nManager`, which only changes on the next launch; the web build flips
   * `dir` live, by the locale. A translation is mirrored by neither, so it
   * has to be told.
   */
  const rtl = Platform.OS === 'web' ? isRtl : I18nManager.isRTL

  const progress = useRef(new Animated.Value(fraction ?? 0)).current
  useEffect(() => {
    // Stopping hands back where the native side had got to, which is what
    // the next run carries on from.
    progress.stopAnimation((current) => {
      const plan = sweepPlan(current, fraction, playing && !reduce, secondsLeft)
      if (plan.from !== null) progress.setValue(plan.from)
      if (plan.ms <= 0) return
      Animated.timing(progress, {
        toValue: 1,
        duration: plan.ms,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start()
    })
  }, [fraction, playing, reduce, secondsLeft, progress])
  useEffect(() => () => progress.stopAnimation(), [progress])

  const sign = rtl ? -1 : 1
  const shift = (direction: number) =>
    progress.interpolate({ inputRange: [0, 1], outputRange: [direction * width, 0] })

  const bars = (opacity: number) =>
    heights.map((height, index) => (
      // Positional by nature: bar 3 is the fourth slice of the note.
      <View key={index} style={[barStyle, { backgroundColor: color, height, opacity }]} />
    ))

  return (
    <>
      {bars(0.3)}
      {width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[CLIP, { transform: [{ translateX: shift(-sign) }] }]}
        >
          <Animated.View style={[rowStyle, { width, transform: [{ translateX: shift(sign) }] }]}>
            {bars(1)}
          </Animated.View>
        </Animated.View>
      ) : null}
    </>
  )
}

const CLIP: ViewStyle = {
  bottom: 0,
  left: 0,
  overflow: 'hidden',
  position: 'absolute',
  right: 0,
  top: 0,
}
