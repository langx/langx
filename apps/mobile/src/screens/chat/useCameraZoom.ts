import { useMemo, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { Gesture } from 'react-native-gesture-handler'
import { runOnJS, useAnimatedProps, useSharedValue } from 'react-native-reanimated'
import {
  atZoomEdge,
  clearOfZoomEdge,
  pinchFactor,
  settleFactor,
  stepFactor,
  zoomProp,
  type ZoomPlatform,
} from '../../lib/cameraZoom'
import { impact } from '../../lib/haptics'

const OS: ZoomPlatform = Platform.OS === 'ios' ? 'ios' : 'android'

/** Instagram's double-tap: two quick taps on the picture, a finger's width apart at most. */
const DOUBLE_TAP_MS = 250
const DOUBLE_TAP_SLOP = 24

/**
 * A change in the `zoom` prop too small to see, but enough for the native
 * side to apply the prop again: both setters skip a value equal to the one
 * they hold. See `resend`.
 */
const NUDGE = 1e-6

function buzz(): void {
  void impact('light')
}

/**
 * The chat camera's viewfinder gestures: pinch to zoom, double-tap to flip.
 *
 * The zoom lives on the UI thread. `factor` is a shared value the pinch
 * multiplies on every frame, and `animatedProps` carries it to the
 * `CameraView` without a React render — nothing in JS changes while the
 * fingers move. React hears only where a pinch came to rest (`settled`), so
 * that the plain `zoom` prop a later render passes (the recording clock
 * re-renders four times a second) is the current zoom rather than
 * expo-camera's default of 0.
 *
 * Pinch and double-tap race: a second finger landing starts the pinch and the
 * tap fails, and a one-finger double-tap never waits on the pinch to fail,
 * which `Exclusive` would make it do.
 */
export function useCameraZoom({
  flipEnabled,
  onDoubleTap,
}: {
  /** Off while recording: a clip keeps its lens. */
  flipEnabled: boolean
  /** Flips the camera, and puts the zoom back to 1 with `reset`. */
  onDoubleTap: () => void
}) {
  const factor = useSharedValue(1)
  /** The next arrival at either end of the range buzzes. */
  const armed = useSharedValue(false)
  const nudge = useSharedValue(0)
  const [settled, setSettled] = useState(1)

  const animatedProps = useAnimatedProps(() => ({
    zoom: Math.max(0, zoomProp(factor.get(), OS) - nudge.get()),
  }))

  // The latest handler, read at tap time, so the gestures need not be rebuilt for it.
  const onDoubleTapRef = useRef(onDoubleTap)
  onDoubleTapRef.current = onDoubleTap

  /*
   * Built once per `flipEnabled`, not per render: the recording clock renders
   * four times a second, and each new gesture object would send its handlers
   * to the UI thread again mid-pinch.
   */
  const gesture = useMemo(() => {
    const pinch = Gesture.Pinch()
      .onStart(() => {
        armed.set(!atZoomEdge(factor.get(), OS))
      })
      .onChange((event) => {
        const next = pinchFactor(factor.get(), event.scaleChange, OS)
        factor.set(next)
        // One tick on reaching 1x or the stop, not a rattle while the fingers hover there.
        if (armed.get() && atZoomEdge(next, OS)) {
          armed.set(false)
          runOnJS(buzz)()
        } else if (!armed.get() && clearOfZoomEdge(next, OS)) {
          armed.set(true)
        }
      })
      .onEnd(() => {
        const rest = settleFactor(factor.get())
        factor.set(rest)
        runOnJS(setSettled)(rest)
      })

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDelay(DOUBLE_TAP_MS)
      .maxDistance(DOUBLE_TAP_SLOP)
      .enabled(flipEnabled)
      .runOnJS(true)
      .onEnd((_event, success) => {
        if (!success) return
        buzz()
        onDoubleTapRef.current()
      })

    return Gesture.Race(pinch, doubleTap)
  }, [flipEnabled, armed, factor])

  /**
   * Back to no zoom. Before a flip, because the other lens has another
   * maximum and a factor carried across would land somewhere surprising.
   */
  function reset(): void {
    factor.set(1)
    setSettled(1)
  }

  /** A screen reader's swipe up or down: twice or half the zoom. */
  function step(direction: 1 | -1): void {
    const next = stepFactor(settled, direction, OS)
    factor.set(next)
    setSettled(next)
  }

  /**
   * Applies the current zoom again. Called on every switch between photo and
   * video: a change of session preset makes AVFoundation reset
   * `videoZoomFactor`, and the prop has not changed, so iOS would not apply
   * it again by itself. Android re-applies its zoom when it rebinds; the
   * nudge is invisible there.
   */
  function resend(): void {
    nudge.set(nudge.get() === 0 ? NUDGE : 0)
  }

  return {
    gesture,
    animatedProps,
    /** The prop React passes, for renders between pinches. */
    zoom: zoomProp(settled, OS),
    zoomed: settled > 1,
    reset,
    step,
    resend,
  }
}
