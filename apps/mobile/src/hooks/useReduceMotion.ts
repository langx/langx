import { useSyncExternalStore } from 'react'
import { AccessibilityInfo } from 'react-native'

/*
 * One answer for the whole app, asked once.
 *
 * Each caller used to hold its own `useState(false)` and ask the OS from an
 * effect, so every mount started at "motion on" and only learned otherwise a
 * frame or two later — long enough for an `Animated` entrance to play its
 * first frames for somebody who had asked for none. A module store asked at
 * import time is usually answered before the first screen that reads it has
 * mounted, and a screen mounted later reads the settled answer on its very
 * first render.
 *
 * One `AccessibilityInfo` listener for the life of the runtime, never
 * removed: the setting can change while the app is open, and the store has to
 * hear it whether or not anything is mounted at that moment.
 */
let reduce = false
const listeners = new Set<() => void>()

function set(next: boolean): void {
  if (next === reduce) return
  reduce = next
  for (const listener of listeners) listener()
}

let started = false
function start(): void {
  if (started) return
  started = true
  void AccessibilityInfo.isReduceMotionEnabled().then(set, () => undefined)
  // RNW returns early — with nothing — when `matchMedia` is unavailable, so
  // the subscription itself has to be treated as optional.
  AccessibilityInfo.addEventListener('reduceMotionChanged', set)
}

// At import, not at first subscribe: the earlier the question is asked, the
// likelier the answer is in before anything animates.
start()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const snapshot = () => reduce
/*
 * `false` for the web export's prerender and for hydrating it, as the old
 * per-instance state started: the prerender's own answer comes from a Node
 * process with no `matchMedia`, and a page drawn from that would not match
 * the browser that hydrates it. The browser's real answer lands right after.
 */
const serverSnapshot = () => false

/**
 * Whether the reader has asked for less movement.
 *
 * Both halves exist on the web: react-native-web maps this onto
 * `prefers-reduced-motion`. The static export's prerender and the hydration
 * of its pages read `false` (`serverSnapshot`); the browser's own answer
 * replaces it right after.
 */
export function useReduceMotion(): boolean {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot)
}
