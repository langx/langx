/**
 * Transient confirmations: the app saying that something it just did worked.
 *
 * Deliberately not part of `alert.ts`, and this is the whole design decision.
 * An alert is a question — it blocks, it waits, and the answer changes what
 * happens next. A confirmation has nothing to decide: it appears, it says what
 * happened, it leaves. Putting both on one queue would make every "Signed out"
 * wait behind a dialog nobody has answered yet, and would put an OK button
 * under a sentence nobody needs to acknowledge.
 *
 * The rule that follows, so it is decided once rather than per screen:
 * **something that worked gets a toast, something that failed gets an alert.**
 * A failure carries detail and is worth interrupting for; missing it because
 * you looked away for four seconds is exactly the outcome `alert.ts` exists to
 * prevent.
 *
 * Same shape as `alert.ts` otherwise and for the same reason: the state lives
 * here, apart from the component that draws it, because `src/lib` is the only
 * directory the test setup can reach. The timer belongs to `ToastHost` so that
 * everything decided in this module stays a pure function of a queue.
 */

export interface Toast {
  id: number
  message: string
  durationMs: number
}

/** Long enough to read a short sentence without having to stop and read it. */
export const TOAST_DURATION_MS = 4000

type Listener = (toast: Toast | null) => void

let nextId = 1
let queue: Toast[] = []
let listener: Listener | null = null

function publish(): void {
  listener?.(queue[0] ?? null)
}

/** `ToastHost` subscribes; the returned function unsubscribes. */
export function subscribeToToasts(next: Listener): () => void {
  listener = next
  publish()
  return () => {
    if (listener === next) listener = null
  }
}

/**
 * Says that something worked.
 *
 * Queues rather than replaces, for the same reason alerts do: two things
 * finishing at once must not leave the user having seen only one of them.
 */
export function showToast(message: string, durationMs: number = TOAST_DURATION_MS): void {
  queue = [...queue, { id: nextId++, message, durationMs }]
  publish()
}

/** Called by `ToastHost` when the timer runs out, or when the banner is tapped. */
export function dismissToast(id: number): void {
  if (!queue.some((toast) => toast.id === id)) return
  queue = queue.filter((toast) => toast.id !== id)
  publish()
}

/** Test seam: drops anything queued. */
export function resetToastsForTest(): void {
  queue = []
  listener = null
  nextId = 1
}
