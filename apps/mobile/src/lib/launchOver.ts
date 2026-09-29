/**
 * "The launch is off the screen." A one-way latch, like `appReady.ts`, and
 * set later than it: the app is ready while the launch film is still playing
 * over it, and only when `AppSplash` has faded and unmounted is there anything
 * for a person to see.
 *
 * What waits on it is anything that opens itself in a `Modal`. A Modal is a
 * window of its own, above every view the app draws — the splash included —
 * so the first-run tour, which starts as soon as Discover has settled, used to
 * open its card on top of the film, pointing at a screen nobody could see yet.
 */
type Listener = () => void

let over = false
const listeners = new Set<Listener>()

export function markLaunchOver(): void {
  if (over) return
  over = true
  for (const listener of listeners) listener()
}

export function isLaunchOver(): boolean {
  return over
}

export function subscribeToLaunchOver(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function resetLaunchOverForTest(): void {
  over = false
  listeners.clear()
}
