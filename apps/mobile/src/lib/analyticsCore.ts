import { sanitizeEventProperties, type AnalyticsEvent } from './analyticsEvents'

/**
 * The slice of the PostHog client this module needs, so the pure part can be
 * tested against a fake and the SDK's own types stay inside `analytics.ts`.
 */
export interface AnalyticsClient {
  capture(event: string, properties?: Record<string, unknown>): void
  screen(name: string): void | Promise<void>
  identify(distinctId: string): void
  getDistinctId(): string
  reset(): void
  optIn(): void | Promise<void>
  optOut(): void | Promise<void>
}

export interface AnalyticsCoreDeps {
  /**
   * The SDK, or `null` when there is no key, no module, or it failed to start.
   * Called once per opt-in; the same instance must come back on the next call.
   */
  loadClient: () => Promise<AnalyticsClient | null>
  readOptOut: () => Promise<boolean>
  writeOptOut: (optOut: boolean) => Promise<void>
}

/**
 * How many calls made before `start()` has read the flag are kept.
 *
 * Boot captures a screen or two and, on a signed-in launch, an identify. Twenty
 * is well past that; if it ever fills, the excess is dropped rather than held,
 * because the alternative is an unbounded list growing under a storage read
 * that never returns.
 */
const MAX_PENDING = 20

type Op = (client: AnalyticsClient) => void

/**
 * The state machine behind `lib/analytics.ts`, kept free of React Native and
 * the SDK so it can be tested — the same split as `resolveApiUrl` next to
 * `apiUrl`.
 *
 * It answers three questions the SDK does not on its own:
 *
 *  1. **What happens before the opt-out flag has been read.** Nothing may be
 *     sent before the answer is known — the first screen of a launch is
 *     captured before SecureStore has replied — so calls are queued and either
 *     replayed once the flag says yes, or dropped once it says no.
 *  2. **What opting out means.** The client is let go, not merely told to
 *     stop: `reset()` discards the anonymous id and `optOut()` discards the
 *     queue, so switching the toggle off leaves nothing on the device that
 *     could be sent later. Opting back in starts from a fresh id.
 *  3. **When identity moves.** `identify` is skipped when the client already
 *     carries that id, so a cold start is not an `$identify` event per launch;
 *     `forget` only resets when somebody *was* identified, so a signed-out
 *     launch does not mint a new anonymous id — which would cut the install
 *     from the sign-up that follows it.
 */
export function createAnalyticsCore(deps: AnalyticsCoreDeps) {
  let optedOut = false
  let ready = false
  let client: AnalyticsClient | null = null
  let identifiedAs: string | null = null
  let starting: Promise<void> | null = null
  const pending: Op[] = []
  const listeners = new Set<() => void>()

  function notify(): void {
    for (const listener of listeners) listener()
  }

  function run(op: Op): void {
    if (!ready) {
      if (pending.length < MAX_PENDING) pending.push(op)
      return
    }
    if (client) op(client)
  }

  function drain(): void {
    const ops = pending.splice(0, pending.length)
    if (!client) return
    for (const op of ops) op(client)
  }

  function start(): Promise<void> {
    starting ??= (async () => {
      optedOut = await deps.readOptOut()
      if (!optedOut) client = await deps.loadClient()
      ready = true
      drain()
      notify()
    })()
    return starting
  }

  async function setEnabled(enabled: boolean): Promise<void> {
    // Behind the boot read: a toggle flipped while the flag is still being
    // read would otherwise be overwritten by the stale answer arriving after.
    await start()
    const optOut = !enabled
    if (optOut === optedOut) return
    optedOut = optOut
    notify()
    await deps.writeOptOut(optOut)
    if (optOut) {
      const leaving = client
      client = null
      if (leaving) {
        leaving.reset()
        await leaving.optOut()
      }
      return
    }
    client = await deps.loadClient()
    if (!client) return
    await client.optIn()
    if (identifiedAs) client.identify(identifiedAs)
  }

  // Arrow properties, not methods: `analytics.ts` re-exports each one on its
  // own, and nothing here reads `this`.
  return {
    start,
    isEnabled: (): boolean => !optedOut,
    /** Whether the stored answer has been read; until then `isEnabled` is the default. */
    isSettled: (): boolean => ready,
    setEnabled,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    track: (event: AnalyticsEvent): void => {
      run((c) => c.capture(event.name, sanitizeEventProperties(event.properties)))
    },
    screen: (name: string): void => {
      run((c) => void c.screen(name))
    },
    identify: (userId: string): void => {
      identifiedAs = userId
      run((c) => {
        if (c.getDistinctId() !== userId) c.identify(userId)
      })
    },
    forget: (): void => {
      if (identifiedAs === null) return
      identifiedAs = null
      run((c) => c.reset())
    },
  }
}

export type AnalyticsCore = ReturnType<typeof createAnalyticsCore>
