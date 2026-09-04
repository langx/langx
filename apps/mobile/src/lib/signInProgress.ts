/**
 * What to say while a sign-in is taking a while.
 *
 * A returning v1 account is restored *inside* the sign-in request — handle
 * claim, profile insert, token credits, conversation import, a RevenueCat
 * round trip — so for those people the call is genuinely slow, and the button
 * spinner said nothing about why. There is no server flag to read: by the time
 * the request resolves the restore has already finished, so the honest signal
 * is the wait itself.
 *
 * Two thresholds rather than one message. Below `SLOW_MS` nothing is shown at
 * all, which is every ordinary sign-in; past it the overlay explains the wait
 * in general terms; past `RESTORE_MS` it names the restore. Escalating this
 * way means the specific claim is only made once the timing has stopped being
 * consistent with anything else — the app never tells someone their v1 profile
 * is being restored when they never had one.
 *
 * Same shape as `toast.ts` and for the same reason: the state lives in
 * `src/lib`, apart from the component that draws it, because that is the only
 * directory the test setup can reach.
 */

export type SignInStage = 'idle' | 'slow' | 'restoring'

/** Long enough that a healthy sign-in is over before anything appears. */
export const SLOW_MS = 1200
/** Past this, no ordinary sign-in is still running. */
export const RESTORE_MS = 4000

type Listener = (stage: SignInStage) => void

let stage: SignInStage = 'idle'
let listener: Listener | null = null
let timers: ReturnType<typeof setTimeout>[] = []

function publish(): void {
  listener?.(stage)
}

/** `SignInProgressHost` subscribes; the returned function unsubscribes. */
export function subscribeToSignInProgress(next: Listener): () => void {
  listener = next
  publish()
  return () => {
    if (listener === next) listener = null
  }
}

function clearTimers(): void {
  for (const timer of timers) clearTimeout(timer)
  timers = []
}

/**
 * Runs `work` and narrates it if it drags.
 *
 * Returns whatever `work` returns and rethrows what it throws, so a caller can
 * wrap an existing call without restructuring it — and the overlay is torn
 * down in a `finally`, so a rejected sign-in cannot leave it up over a screen
 * the user is trying to correct.
 */
export async function withSignInProgress<T>(work: () => Promise<T>): Promise<T> {
  clearTimers()
  stage = 'idle'
  publish()
  timers.push(
    setTimeout(() => {
      stage = 'slow'
      publish()
    }, SLOW_MS),
    setTimeout(() => {
      stage = 'restoring'
      publish()
    }, RESTORE_MS),
  )
  try {
    return await work()
  } finally {
    clearTimers()
    stage = 'idle'
    publish()
  }
}

/** Test seam. */
export function resetSignInProgressForTest(): void {
  clearTimers()
  stage = 'idle'
  listener = null
}
