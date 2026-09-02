import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

/**
 * Whether the reader has asked for less movement.
 *
 * The app's first use of `AccessibilityInfo`. Both halves exist on the web:
 * react-native-web maps this onto `prefers-reduced-motion`, and resolves
 * `true` when there is no `matchMedia` at all — during the static export's
 * prerender, say. That is the safe way round: no motion rather than motion
 * nobody asked for.
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false)

  useEffect(() => {
    let cancelled = false
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (!cancelled) setReduce(value)
    })
    // RNW returns early — with nothing — when `matchMedia` is unavailable, so
    // the subscription itself has to be treated as optional.
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce) as
      { remove: () => void } | undefined
    return () => {
      cancelled = true
      subscription?.remove()
    }
  }, [])

  return reduce
}
