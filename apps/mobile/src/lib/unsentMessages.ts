/**
 * Messages typed into the composer that never reached the server.
 *
 * Kept because the alternative is what the app did before: `send()` had a
 * `try/finally` with no `catch`, both call sites were `void send()`, and there
 * is no global rejection handler — so a failed send became an unhandled promise
 * rejection and the reader was shown nothing at all. The text survived only in
 * React state, and only until they left the screen.
 *
 * A pure module so the queue is reachable by vitest, which only sees
 * `src/lib/**` and `src/i18n/**`. The same logic inside the chat screen would
 * never be tested.
 *
 * Not persisted yet, deliberately. Surviving an app kill needs a real store —
 * `localFlags` swallows its own write failures by design, which is exactly the
 * wrong contract for a queue — and a server-side `clientId` so a retry cannot
 * double-post. Both are their own change; this one stops the silent loss.
 */

export interface UnsentMessage {
  /** Client-minted, so a row exists before the server has given it an id. */
  clientId: string
  body: string
  replyToMessageId?: string
  /** For ordering, and so a retry can report how long it has been waiting. */
  failedAt: string
}

/**
 * A ceiling, so a long offline stretch cannot grow the thread without bound.
 * Well above any realistic run of failures — this is a guard, not a quota.
 */
export const MAX_UNSENT = 20

/**
 * Newest first, matching the inverted thread it is rendered into.
 *
 * Replaces by `clientId` rather than appending, so a retry that fails again
 * updates the row it came from instead of stacking a second copy of the same
 * sentence.
 */
export function addUnsent(list: readonly UnsentMessage[], message: UnsentMessage): UnsentMessage[] {
  const withoutSelf = list.filter((entry) => entry.clientId !== message.clientId)
  return [message, ...withoutSelf].slice(0, MAX_UNSENT)
}

export function removeUnsent(list: readonly UnsentMessage[], clientId: string): UnsentMessage[] {
  return list.filter((entry) => entry.clientId !== clientId)
}

/**
 * Drops rows whose message turns out to have arrived after all.
 *
 * A send whose ack is lost is indistinguishable from one that never left, so
 * the row appears either way — and a message that *did* land then sits in the
 * thread twice, once as delivered and once as "not sent". The server echoes the
 * `clientId` back to its author precisely so the second one can be retired.
 */
export function retireDelivered(
  list: readonly UnsentMessage[],
  deliveredClientIds: readonly (string | undefined)[],
): UnsentMessage[] {
  const delivered = new Set(deliveredClientIds.filter((id): id is string => Boolean(id)))
  if (delivered.size === 0) return list as UnsentMessage[]
  return list.filter((entry) => !delivered.has(entry.clientId))
}

/**
 * A client id that does not need `crypto.randomUUID`, which Hermes does not
 * ship. Only ever compared against other ids in this list, so it needs to be
 * unique on one device and nothing more.
 */
export function newClientId(now: number, random: number): string {
  return `${now.toString(36)}-${Math.floor(random * 1e9).toString(36)}`
}
