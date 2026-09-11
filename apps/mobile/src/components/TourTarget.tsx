import { useEffect, useRef, type ReactNode } from 'react'
import { View, type ViewStyle } from 'react-native'
import { registerTourTarget, type TourRect, type TourTargetId } from '../lib/tour'

/**
 * How long a measurement is waited for before the step gives up on it.
 *
 * `measureInWindow` takes a callback that is not guaranteed to fire — a view
 * detached between the call and the layout pass never answers at all, and a
 * promise nobody settles would hold the overlay open on a blank screen. The
 * same fallback `MessageBubble` keeps around its own measurement, for the same
 * reason.
 */
const MEASURE_TIMEOUT_MS = 400

interface TourTargetProps {
  id: TourTargetId
  /**
   * Passed to the wrapper, because wrapping changes layout: a `View` around a
   * row's trailing button is a new flex child, and a caller sometimes has to
   * give it back the shrink or the flex it displaced.
   */
  style?: ViewStyle
  children: ReactNode
}

/**
 * Offers whatever it wraps to the tour as something that can be pointed at.
 *
 * Nothing is drawn here and nothing is measured until a step asks: the tour
 * plays once per install, and a measurement taken at mount would be wrong by
 * the time it mattered anyway — the list scrolls, the chip row appears, the
 * keyboard opens.
 *
 * `collapsable={false}` because Android flattens a view that draws nothing
 * into its parent, and a flattened view has no native node to measure — the
 * highlight would land on the whole column instead of the button inside it.
 */
export function TourTarget({ id, style, children }: TourTargetProps) {
  const ref = useRef<View>(null)

  useEffect(
    () =>
      registerTourTarget(
        id,
        () =>
          new Promise<TourRect | null>((resolve) => {
            const node = ref.current
            if (!node) return resolve(null)
            const timer = setTimeout(() => resolve(null), MEASURE_TIMEOUT_MS)
            node.measureInWindow((x, y, width, height) => {
              clearTimeout(timer)
              // A view that has been laid out at zero size is not somewhere to
              // point an arrow, and on web an element still being mounted
              // reports exactly that.
              resolve(width > 0 && height > 0 ? { x, y, width, height } : null)
            })
          }),
      ),
    [id],
  )

  return (
    <View ref={ref} collapsable={false} {...(style ? { style } : {})}>
      {children}
    </View>
  )
}
