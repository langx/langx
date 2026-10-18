import { useSegments } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, Platform, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAppReady } from '../hooks/useAppReady'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { SPLASH_TIMING } from '../lib/splashTiming'
import {
  dismissToast,
  msUntilToastsMayShow,
  subscribeToToasts,
  toastEdge,
  type Toast,
} from '../lib/toast'
import { OVERLAY_LAYER } from '../lib/overlayLayers'
import { makeStyles } from '../lib/theme'
import { CURVE, DURATION } from '../lib/theme/motionValues'

/** `motion.ts`'s `EASE_OUT`, on React Native's `Easing`. */
const EASE_OUT = Easing.bezier(...CURVE.out)

/** How far the pill travels in and out, towards the edge it sits on. */
const DRIFT = 10

/**
 * Draws whatever `src/lib/toast.ts` has queued.
 *
 * Mounted once at the root and *after* the navigator, so it paints over every
 * screen and survives the screen underneath it going away — signing out
 * replaces the route immediately, and a banner owned by the profile screen
 * would die with it, which is the one moment it has something to say.
 *
 * A plain absolutely positioned view rather than `Modal`, which is what
 * `AlertHost` uses: a `Modal` takes the touches of the whole screen, and a
 * message with nothing to decide must not stop anyone from carrying on while
 * it is up. `pointerEvents="box-none"` keeps that true of the full-width layer
 * — only the pill itself is tappable, and tapping it dismisses early.
 *
 * It leaves the way it came: when the queue moves on — the timer, a tap — the
 * pill drifts back towards its edge and fades, and only then does the next one
 * (or nothing) take its place. It used to vanish between one frame and the
 * next, which read as a glitch rather than as a message that had been read.
 * The way out is quicker than the way in. Under reduce motion it neither
 * drifts nor fades: it is there, then it is not.
 *
 * React Native's `Animated`, not Reanimated: this is mounted at the root, so
 * it is on the launch path (_The row swipe runs on the UI thread_).
 */
export function ToastHost() {
  const styles = useStyles()
  const reduce = useReduceMotion()

  /** The head of the queue — what should be showing. */
  const [head, setHead] = useState<Toast | null>(null)
  /** What is drawn. Lags `head` by the length of the way out. */
  const [shown, setShown] = useState<Toast | null>(null)
  const [leaving, setLeaving] = useState(false)
  const enter = useRef(new Animated.Value(0)).current
  const insets = useSafeAreaInsets()
  const edge = toastEdge(useSegments())

  useEffect(() => subscribeToToasts(setHead), [])

  /*
   * Held back until the opening has gone, and its clock with it — see
   * `msUntilToastsMayShow`. Queued toasts wait rather than being dropped.
   */
  const ready = useAppReady()
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    if (!ready || settled) return
    const timer = setTimeout(() => setSettled(true), msUntilToastsMayShow(SPLASH_TIMING))
    return () => clearTimeout(timer)
  }, [ready, settled])

  // The queue moved on: the drawn pill leaves first. A second change during
  // the way out stops it and starts it again from where it got to, so the
  // pill never jumps back in to leave a second time.
  //
  // The swap runs on a timer of the same length, not on the animation's end:
  // a native-driver animation early in a launch has been known not to
  // connect (_The root overlays carry a paint order, not just a place in the
  // tree_), and a swap waiting on one that never ends would hold every later
  // toast behind this one.
  useEffect(() => {
    if (head?.id === shown?.id) return
    if (!shown || !settled || reduce) {
      setShown(head)
      return
    }
    setLeaving(true)
    const out = Animated.timing(enter, {
      toValue: 0,
      duration: DURATION.release,
      easing: EASE_OUT,
      useNativeDriver: true,
    })
    out.start()
    const swap = setTimeout(() => {
      setLeaving(false)
      setShown(head)
    }, DURATION.release)
    return () => {
      clearTimeout(swap)
      out.stop()
    }
  }, [head, shown, settled, reduce, enter])

  useEffect(() => {
    if (!shown || !settled) return
    if (reduce) {
      enter.setValue(1)
    } else {
      enter.setValue(0)
      Animated.timing(enter, {
        toValue: 1,
        duration: DURATION.enter,
        easing: EASE_OUT,
        useNativeDriver: true,
      }).start()
    }
    // Keyed on the toast, so a second one arriving restarts the clock for
    // itself rather than inheriting what was left of the first one's.
    const timer = setTimeout(() => dismissToast(shown.id), shown.durationMs)
    return () => clearTimeout(timer)
  }, [shown, enter, settled, reduce])

  if (!shown || !settled) return null

  return (
    <Animated.View
      // Nothing on the way out takes a tap: what is under it is what the
      // finger is going for now.
      pointerEvents={leaving ? 'none' : 'box-none'}
      style={[
        styles.layer,
        // Above the tab bar with room to spare, and above the committing
        // button on a screen that has one — the band v3 leaves for it.
        edge === 'top' ? { top: insets.top + 12 } : { bottom: insets.bottom + 86 },
        {
          opacity: enter,
          transform: [
            {
              translateY: enter.interpolate({
                inputRange: [0, 1],
                outputRange: [edge === 'top' ? -DRIFT : DRIFT, 0],
              }),
            },
          ],
        },
      ]}
    >
      <Pressable
        accessibilityRole="alert"
        onPress={() => dismissToast(shown.id)}
        style={[styles.pill, shown.action ? styles.pillWithAction : null]}
      >
        <Text style={styles.text}>{shown.message}</Text>
        {shown.action ? (
          // Its own `Pressable` inside the pill's, so the two taps mean
          // different things: the action runs, and anywhere else dismisses.
          // Running it also dismisses — leaving the pill up after the tap
          // would invite a second one.
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              shown.action?.onPress()
              dismissToast(shown.id)
            }}
            style={styles.action}
          >
            <View style={styles.actionGround} />
            <Text style={styles.actionLabel}>{shown.action.label}</Text>
          </Pressable>
        ) : null}
      </Pressable>
    </Animated.View>
  )
}

/** The action's own target: 44pt on iOS, 48dp on Android. */
const ACTION_HEIGHT = Platform.select({ android: 48, default: 44 })

const useStyles = makeStyles(({ spacing, v3 }) => ({
  /**
   * Bottom, where v3 puts it: the confirmation appears near the thumb that
   * caused it. It used to sit at the top so as not to cover a button, and the
   * pill is narrow enough now — hugging its sentence rather than spanning the
   * screen — that what it covers is a sliver of whatever is under it, for four
   * seconds, and a tap on the pill ends that early.
   */
  layer: {
    alignItems: 'center',
    // The same reason the message banner carries one; see `overlayLayers.ts`.
    elevation: OVERLAY_LAYER.toast,
    left: 0,
    paddingHorizontal: spacing.lg,
    position: 'absolute',
    right: 0,
    zIndex: OVERLAY_LAYER.toast,
  },
  // v3's ink pill, not yellow: these sentences report what happened, and the
  // one yellow on a screen is reserved for the thing that makes something
  // happen. Flat, as everything in v3 is — the pill inverts with the scheme,
  // so it stands off the ground by colour alone.
  pill: {
    alignItems: 'center',
    backgroundColor: v3.colors.pill,
    borderRadius: v3.radius.pill,
    // A row only ever holds a sentence and one word, so it stays a row: the
    // pill still hugs its content when there is no action.
    flexDirection: 'row',
    gap: v3.space[10],
    maxWidth: 420,
    minHeight: 44,
    paddingHorizontal: v3.space[20],
    paddingVertical: v3.space[10],
  },
  // The action is a pill of its own inside this one, so the pill's end hugs
  // it with the same 4pt it leaves above and below.
  pillWithAction: {
    paddingBottom: v3.space[4],
    paddingEnd: v3.space[4],
    paddingStart: v3.space[16],
    paddingTop: v3.space[4],
  },
  // `flexShrink` rather than `flex: 1`, so a message with no action beside it
  // is still centred on its own width instead of stretching to the maximum.
  text: { ...v3.type.buttonSmall, color: v3.colors.pillText, flexShrink: 1, textAlign: 'center' },
  action: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    justifyContent: 'center',
    minHeight: ACTION_HEIGHT,
    overflow: 'hidden',
    paddingHorizontal: v3.space[16],
  },
  /**
   * A shade of the label's own colour over the pill: a step lighter on the
   * ink pill in light, a step darker on the pale one in dark. Any one palette
   * colour would do only one of the two, because the pill inverts.
   */
  actionGround: {
    backgroundColor: v3.colors.pillText,
    bottom: 0,
    end: 0,
    opacity: 0.14,
    position: 'absolute',
    start: 0,
    top: 0,
  },
  actionLabel: { ...v3.type.buttonSmall, color: v3.colors.pillText },
}))
