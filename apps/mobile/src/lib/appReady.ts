/**
 * "The first real screen is up." A one-way latch, and that is the whole design.
 *
 * `useSession()` re-enters `isPending` on every sign-in, sign-up and sign-out
 * — the note at `app/_layout.tsx` explains what that costs the navigator. If
 * this were a boolean tracking a condition, the splash would come back over
 * the app every time somebody signed out. It cannot: once flipped it stays
 * flipped for the life of the JS context, which is also why Fast Refresh does
 * not replay the animation.
 *
 * Here rather than in a context for the reason `toast.ts` is: the callers
 * include a timeout and `AppGate`, neither of which wants a hook, and `src/lib`
 * is the only tree the test setup can reach.
 */
type Listener = () => void

let ready = false
const listeners = new Set<Listener>()

export function markAppReady(): void {
  if (ready) return
  ready = true
  for (const listener of listeners) listener()
}

export function isAppReady(): boolean {
  return ready
}

/** A `Set`, not `toast.ts`'s single slot: the overlay and the fill both listen. */
export function subscribeToAppReady(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function resetAppReadyForTest(): void {
  ready = false
  listeners.clear()
}
