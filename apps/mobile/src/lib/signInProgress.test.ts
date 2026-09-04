import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  RESTORE_MS,
  SLOW_MS,
  resetSignInProgressForTest,
  subscribeToSignInProgress,
  withSignInProgress,
  type SignInStage,
} from './signInProgress'

afterEach(() => {
  resetSignInProgressForTest()
  vi.useRealTimers()
})

/** Collects everything the host would have been told to draw. */
function record(): SignInStage[] {
  const seen: SignInStage[] = []
  subscribeToSignInProgress((stage) => seen.push(stage))
  return seen
}

describe('sign-in progress', () => {
  it('says nothing at all about a sign-in that returns quickly', async () => {
    vi.useFakeTimers()
    const seen = record()

    await withSignInProgress(() => Promise.resolve('ok'))

    // The subscribe itself reports the current stage; nothing after it moved.
    expect(seen.every((stage) => stage === 'idle')).toBe(true)
  })

  it('escalates to the restore wording only once no ordinary sign-in is still plausible', async () => {
    vi.useFakeTimers()
    const seen = record()

    let settle: (value: string) => void = () => {}
    const pending = withSignInProgress(
      () =>
        new Promise<string>((resolve) => {
          settle = resolve
        }),
    )

    await vi.advanceTimersByTimeAsync(SLOW_MS)
    expect(seen.at(-1)).toBe('slow')
    // Still only the general wording: this is the window where a slow network
    // and a restore look the same, and claiming a v1 profile here would be a
    // guess made at somebody who may never have had one.
    await vi.advanceTimersByTimeAsync(RESTORE_MS - SLOW_MS - 1)
    expect(seen.at(-1)).toBe('slow')

    await vi.advanceTimersByTimeAsync(1)
    expect(seen.at(-1)).toBe('restoring')

    settle('done')
    await pending
    expect(seen.at(-1)).toBe('idle')
  })

  it('takes the overlay down when the sign-in fails, and rethrows', async () => {
    vi.useFakeTimers()
    const seen = record()

    // Rejected on demand rather than up front, so the overlay is provably up
    // before the failure — and so there is no window in which the rejection is
    // floating unhandled.
    let fail: (reason: Error) => void = () => {}
    const failure = withSignInProgress(
      () =>
        new Promise<string>((_resolve, reject) => {
          fail = reject
        }),
    )

    await vi.advanceTimersByTimeAsync(RESTORE_MS)
    expect(seen.at(-1)).toBe('restoring')

    fail(new Error('nope'))
    await expect(failure).rejects.toThrow('nope')

    /*
     * The reason this is a `finally` rather than a success path: a rejected
     * sign-in leaves the user on a form they need to correct, and an overlay
     * that takes every touch would make the form unusable with no way back.
     */
    expect(seen.at(-1)).toBe('idle')
  })

  it('does not let a finished sign-in raise the overlay behind the next one', async () => {
    vi.useFakeTimers()
    const seen = record()

    await withSignInProgress(() => Promise.resolve('first'))
    // The first call's timers must not still be armed. Before `clearTimers`
    // ran in `finally`, they were — and fired over whatever came next.
    await vi.advanceTimersByTimeAsync(RESTORE_MS * 2)
    expect(seen.every((stage) => stage === 'idle')).toBe(true)
  })
})
