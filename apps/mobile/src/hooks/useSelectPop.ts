import { useEffect, useLayoutEffect, useRef } from 'react'
import { AccessibilityInfo, Animated } from 'react-native'
import { shouldPop } from '../lib/selectPop'
import { EASE_POP } from '../lib/theme/motionAnimated'
import { DURATION } from '../lib/theme/motionValues'

/*
 * Reduce motion, read once for every caller rather than once per caller.
 *
 * This hook sits on rows that come by the hundred — every language on the
 * onboarding picker is a `ChoiceRowV3` — and `useReduceMotion` is a
 * subscription and a native round trip per mount. A pop only needs the answer
 * at the moment of a press, which is long after the first read has come back.
 */
let reduceMotionNow = false
let watching = false

function watchReduceMotion(): void {
  if (watching) return
  watching = true
  void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
    reduceMotionNow = value
  })
  // RNW gives nothing back without `matchMedia`; see `useReduceMotion`.
  AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
    reduceMotionNow = value
  })
}

/**
 * A scale that pops from `from` to 1 when `selected` turns true by a change,
 * never on mount — see `lib/selectPop.ts`. Put it on the tick or the pill:
 * `transform: [{ scale }]`.
 *
 * RN `Animated` on the native driver, because the onboarding steps use it and
 * the launch path does not load Reanimated.
 */
export function useSelectPop(selected: boolean, from: number): Animated.Value {
  const scale = useRef(new Animated.Value(1)).current
  const was = useRef(selected)

  useEffect(() => {
    watchReduceMotion()
  }, [])

  // A layout effect, so the shrunk start is set before the frame that first
  // draws the choice: an effect would paint it full size once, then shrink it.
  useLayoutEffect(() => {
    const pop = shouldPop(was.current, selected, reduceMotionNow)
    was.current = selected
    if (!pop) return
    scale.setValue(from)
    const animation = Animated.timing(scale, {
      toValue: 1,
      duration: DURATION.enter,
      easing: EASE_POP,
      useNativeDriver: true,
    })
    animation.start()
    // Left to finish when the row is let go of again: stopping it part-way
    // would leave the tick small. A new pop starts from `from` regardless.
  }, [selected, from, scale])

  return scale
}
