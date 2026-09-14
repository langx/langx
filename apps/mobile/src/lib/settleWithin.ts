/**
 * Waits for a piece of best-effort housekeeping — but not for longer than it
 * is worth waiting for.
 *
 * What this guards against is not a rejection but a promise that never settles
 * at all, which is a different failure and needs a different answer: a `catch`
 * cannot catch it, and `await` on it is forever. `apiFetch` documents the same
 * gap for `fetch` and closes it with `AbortController`; the calls here are
 * native modules with no signal to abort, so the only thing left is to stop
 * waiting on them.
 *
 * Never rejects, and answers nothing about what happened. Both are deliberate:
 * every caller is already swallowing failures, and a caller that has to know
 * whether the work finished has no business being on a budget.
 */
export function settleWithin(ms: number, work: Promise<unknown>): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    const done = (): void => {
      clearTimeout(timer)
      resolve()
    }
    // Both handlers, rather than `.finally`: a rejection has to be consumed
    // here or it surfaces as an unhandled one the moment the budget wins.
    work.then(done, done)
  })
}
