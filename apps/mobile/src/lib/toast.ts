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
 * A toast may carry one `action`, and that does not make it a question. The
 * distinction that keeps it out of `alert.ts` is what happens when the four
 * seconds run out with nobody looking: an alert's answer decides what happens
 * next, so it has to wait; an action here is a shortcut to something that is
 * going to happen anyway, so letting it expire is a complete answer. The one
 * caller is the downloaded-update notice — the update applies on the next
 * launch either way, and the action only offers to bring that forward.
 *
 * Same shape as `alert.ts` otherwise and for the same reason: the state lives
 * here, apart from the component that draws it, because `src/lib` is the only
 * directory the test setup can reach. The timer belongs to `ToastHost` so that
 * everything decided in this module stays a pure function of a queue.
 */

export interface ToastAction {
  label: string
  onPress: () => void
}

export interface Toast {
  id: number
  message: string
  durationMs: number
  action?: ToastAction
}

/** Long enough to read a short sentence without having to stop and read it. */
export const TOAST_DURATION_MS = 4000

/**
 * For a toast that offers something to press. Reading the sentence is not the
 * whole job: the reader then has to decide, and reach for it. At four seconds
 * the pill was gone by the time a thumb arrived, and the tap landed on
 * whatever had been underneath it — on the welcome screen, "Create an
 * account".
 */
export const ACTION_TOAST_DURATION_MS = 8000

/**
 * How long after the app says it is ready a toast may appear.
 *
 * `markAppReady` fires when the first screen is up, which is when the opening
 * animation *starts* to leave, not when it has gone: it may still hold for its
 * minimum time and then fades out over its own exit. A toast raised before
 * then — the update notice, whose download often finishes during that very
 * opening — spent most of its life under the logo, surfaced for a moment and
 * vanished as the reader went for it. The numbers are the opening's own:
 * its longest hold plus its exit.
 */
export function msUntilToastsMayShow(timing: {
  MIN_VISIBLE_MS: number
  EXIT_GROUND_DELAY_MS: number
  EXIT_GROUND_MS: number
}): number {
  return timing.MIN_VISIBLE_MS + timing.EXIT_GROUND_DELAY_MS + timing.EXIT_GROUND_MS
}

/**
 * Which edge a toast sits on, from the route's segments.
 *
 * The bottom, above the tab bar, everywhere the tab bar is. The signed-out
 * screens have no tab bar, and their bottom is exactly where their buttons
 * are — the pill sat on "Create an account" — so there it sits at the top.
 */
export function toastEdge(segments: readonly string[]): 'top' | 'bottom' {
  return segments[0] === '(auth)' ? 'top' : 'bottom'
}

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
export function showToast(
  message: string,
  durationMs: number = TOAST_DURATION_MS,
  action?: ToastAction,
): void {
  // Spread rather than assigned: `exactOptionalPropertyTypes` distinguishes an
  // absent key from one holding `undefined`, and `Toast.action` is absent.
  queue = [...queue, { id: nextId++, message, durationMs, ...(action ? { action } : {}) }]
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
