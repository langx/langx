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
 * Persisted since the tunnel work, through `unsentStore.ts` — the half of it
 * that touches `localFlags` lives there, so this file stays loadable by the
 * tests. The two things that made it wait have both arrived: the server
 * refuses a second message with the same `(senderId, clientId)` by unique
 * index, so a retry cannot double-post, and the store's swallowed write
 * failures are the right contract after all once the promise is read as "kept
 * where possible" rather than "queued". A write that fails leaves exactly what
 * was there before this: a row that lives as long as the screen does.
 */

import type { MessageAsk, MessageTranslation } from '@langx/shared'

export interface UnsentMessage {
  /** Client-minted, so a row exists before the server has given it an id. */
  clientId: string
  body: string
  replyToMessageId?: string
  /** The sentence of that message the reply is to, when it is not all of it. */
  quote?: string
  /**
   * What the sentence asked for — a correction, a pronunciation. Without it a
   * tap on the row sent the sentence as a plain message and the question was
   * gone.
   */
  ask?: MessageAsk
  /**
   * The translation it was sent with. The translate call is not made again on
   * a retry, so without this the message arrived without it.
   */
  translation?: MessageTranslation
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

/**
 * The row a failed send leaves behind. Here rather than inline in the chat
 * screen so what it keeps — and so what a retry can send again — is tested.
 */
export function failedSend(
  send: {
    clientId: string
    body: string
    replyToMessageId?: string | undefined
    quote?: string | undefined
    ask?: MessageAsk | undefined
    translation?: MessageTranslation | undefined
  },
  now: Date,
): UnsentMessage {
  return {
    clientId: send.clientId,
    body: send.body,
    ...(send.replyToMessageId ? { replyToMessageId: send.replyToMessageId } : {}),
    ...(send.replyToMessageId && send.quote ? { quote: send.quote } : {}),
    ...(send.ask ? { ask: send.ask } : {}),
    ...(send.translation ? { translation: send.translation } : {}),
    failedAt: now.toISOString(),
  }
}

/**
 * The stored rows joined to the ones already in memory, rather than written
 * over them.
 *
 * The read waits for `me`, and a send can fail before `me` has loaded — a cold
 * start in a tunnel is exactly when both happen. That row is in memory only,
 * and replacing the list with the stored one threw away the one copy of the
 * sentence. The in-memory copy wins a tie: it is the later of the two.
 */
export function mergeUnsent(
  inMemory: readonly UnsentMessage[],
  stored: readonly UnsentMessage[],
): UnsentMessage[] {
  if (inMemory.length === 0) return [...stored]
  const seen = new Set(inMemory.map((entry) => entry.clientId))
  return [...inMemory, ...stored.filter((entry) => !seen.has(entry.clientId))].slice(0, MAX_UNSENT)
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

/**
 * Where one account's rows for one conversation sit in the stored record.
 *
 * The account is part of the key because the record belongs to the device,
 * not to whoever is signed in, and a conversation id is shared by both people
 * in it. Keyed by conversation alone, a sentence one person failed to send
 * was drawn to the next person who signed in on the same phone or browser as
 * their own "not sent" row — and one tap on it sent it, under their name, to
 * the person it was written to. Clearing the record on sign-out would not
 * have been enough: a session that ends while the app is closed is never seen
 * ending, and it would also throw away the one copy of a sentence its own
 * author signs back in to find.
 *
 * Rows stored before this, under the bare conversation id, are never read
 * again, and `storeUnsent` drops them on its first write.
 */
export function unsentKey(userId: string, conversationId: string): string {
  return `${userId}:${conversationId}`
}

/** One account's rows for one conversation, or none. */
export function readUnsent(
  stored: UnsentByConversation | null | undefined,
  userId: string,
  conversationId: string,
): UnsentMessage[] {
  const rows = stored?.[unsentKey(userId, conversationId)]
  return Array.isArray(rows) ? rows : []
}

/**
 * Every conversation's unsent rows, as one stored value.
 *
 * One key rather than a key per conversation: the store is `expo-secure-store`
 * on native, whose keys are not enumerable, so anything written per
 * conversation could never be found again to clean up. Bounded on both axes —
 * `MAX_UNSENT` rows within a thread, `MAX_UNSENT_THREADS` threads — because a
 * record that only ever grows is a slow way to fill a keychain.
 */
/** Keyed by `unsentKey`. */
export type UnsentByConversation = Record<string, UnsentMessage[]>

export const MAX_UNSENT_THREADS = 10

/**
 * Writes one conversation's rows into the record, newest thread first, and
 * drops a thread that has nothing left in it. Pure, so the bounding is
 * testable without a device.
 *
 * Also drops any key without an account in it — rows from before `unsentKey`,
 * never read again but still somebody's words, and left to sit until nine
 * newer threads pushed them out.
 */
export function storeUnsent(
  stored: UnsentByConversation,
  conversationId: string,
  list: readonly UnsentMessage[],
): UnsentByConversation {
  const rest: [string, UnsentMessage[]][] = Object.entries(stored).filter(
    ([id]) => id !== conversationId && id.includes(':'),
  )
  const kept: [string, UnsentMessage[]][] =
    list.length > 0 ? [[conversationId, [...list]], ...rest] : rest
  return Object.fromEntries(kept.slice(0, MAX_UNSENT_THREADS))
}
