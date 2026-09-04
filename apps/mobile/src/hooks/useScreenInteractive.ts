import { useObserve } from 'expo-observe'
import { useEffect } from 'react'

/**
 * "This screen is now something a person can use" — EAS Observe's `tti`.
 *
 * Called from inside a screen component and nowhere else. `useObserve()` reads
 * the route it is rendered under to tag the metric, so the same call from a
 * layout or from above the navigator has no screen to attribute anything to
 * and is dropped with a warning. That is why this is a hook every screen calls
 * rather than one call at the root: only the screen knows it is the screen.
 *
 * Marking on mount is the default because that is when most of these screens
 * are genuinely usable — they render their own skeletons and stay interactive
 * throughout. Pass `ready` on a screen where the first paint is not usable
 * (a form that cannot be submitted until its options arrive, say) and the mark
 * moves to the first render where that is true.
 *
 * Only the first mark per navigation is recorded, and one from an unfocused
 * screen is discarded, so calling it too eagerly costs a truthful number but
 * never a duplicate.
 */
export function useScreenInteractive(ready = true): void {
  const { markInteractive } = useObserve()

  useEffect(() => {
    if (ready) markInteractive()
  }, [ready, markInteractive])
}
