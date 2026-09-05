/**
 * The signed-in devices list: how it is ordered, and how it learns that an
 * approval landed.
 *
 * Pure, so `vitest.config.ts` reaches it. The screen owns the query; these own
 * the two decisions the screen kept getting wrong.
 */

export interface SessionRow {
  token: string
  createdAt: Date | string
}

/** Newest first — the row somebody just approved is the one they are looking for. */
export function sortSessions<T extends SessionRow>(sessions: readonly T[]): T[] {
  return [...sessions].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

export interface AwaitNewSessionOptions {
  /** How often to ask again. Default 2 s — the browser's own poll interval. */
  intervalMs?: number
  /** When to give up. Default 30 s. */
  timeoutMs?: number
  /** Injected so a test does not wait. */
  sleep?: (ms: number) => Promise<void>
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Refetch the list until a session that was not there before shows up.
 *
 * Approving a device does not create its session; the *browser* does that on
 * its next poll, up to one poll interval later. A single refetch fired the
 * moment the approval returned always ran before the row existed, so the list
 * looked unchanged until somebody left the screen and came back. This keeps
 * asking, on the browser's own rhythm, and stops the moment the row lands.
 *
 * Resolves with the new row, or `null` when nothing arrived in time — a
 * timeout is not an error, the approval itself already succeeded.
 */
export async function awaitNewSession<T extends SessionRow>(
  refetch: () => Promise<readonly T[] | undefined>,
  known: ReadonlySet<string>,
  options: AwaitNewSessionOptions = {},
): Promise<T | null> {
  const intervalMs = options.intervalMs ?? 2000
  const timeoutMs = options.timeoutMs ?? 30_000
  const sleep = options.sleep ?? defaultSleep
  const attempts = Math.max(1, Math.ceil(timeoutMs / intervalMs))
  for (let attempt = 0; attempt < attempts; attempt++) {
    await sleep(intervalMs)
    const rows = await refetch().catch(() => undefined)
    const fresh = rows?.find((row) => !known.has(row.token))
    if (fresh) return fresh
  }
  return null
}
