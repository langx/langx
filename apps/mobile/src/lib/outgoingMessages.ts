import type { MessageAsk } from '@langx/shared'
/**
 * Messages the composer has handed off and the server has not yet echoed.
 *
 * Pressing Send used to lock the composer and wait for the socket's ack: the
 * text stayed in the field, the button turned into a spinner, and a second
 * sentence could not be typed until the first had landed. Now the field clears
 * on the press and the sentence moves into the thread at once, drawn as your
 * own bubble with "Sending" under it, and gives way to the real message when
 * the server echoes it back with the same `clientId`. Two or three can be in
 * the air at a time; each is its own row with its own id.
 *
 * A pure module for the reason `unsentMessages` is: vitest only sees
 * `src/lib/**`, so the queue has to live where it can be tested. It is that
 * queue's sibling in shape — a message goes from here to there when its send
 * fails, and to nowhere when it succeeds.
 */
export interface OutgoingMessage {
  /** Client-minted, the same id the send carries; the echo brings it back. */
  clientId: string
  body: string
  /** The quote the row draws, in the shape the server would snapshot it. */
  replyTo?: { messageId: string; senderId: string; preview: string }
  /** What the sender asked for back, so the badge is drawn before the ack. */
  ask?: MessageAsk
  /** When Send was pressed — the row's clock until the server's own arrives. */
  sentAt: string
}

/**
 * Well above the two or three a fast typist has in the air at once. A guard,
 * not a quota: nothing here is refused, the oldest stand-in is dropped.
 */
export const MAX_OUTGOING = 20

/** Newest first, like the inverted thread. Replaces by `clientId` rather than stacking. */
export function addOutgoing(
  list: readonly OutgoingMessage[],
  message: OutgoingMessage,
): OutgoingMessage[] {
  const withoutSelf = list.filter((entry) => entry.clientId !== message.clientId)
  return [message, ...withoutSelf].slice(0, MAX_OUTGOING)
}

export function removeOutgoing(
  list: readonly OutgoingMessage[],
  clientId: string,
): OutgoingMessage[] {
  return list.filter((entry) => entry.clientId !== clientId)
}

/**
 * Drops the rows whose message the thread now holds.
 *
 * The ack and the echo race, and either may arrive first; whichever the
 * screen sees first retires the stand-in, so the sentence is never on screen
 * twice.
 */
export function retireArrived(
  list: readonly OutgoingMessage[],
  arrivedClientIds: readonly (string | undefined)[],
): OutgoingMessage[] {
  const arrived = new Set(arrivedClientIds.filter((id): id is string => Boolean(id)))
  if (arrived.size === 0) return list as OutgoingMessage[]
  return list.filter((entry) => !arrived.has(entry.clientId))
}

/**
 * The id a stand-in row carries until the server names the message. Prefixed
 * so the thread can tell it apart: a long-press or a reply on a row the server
 * does not know yet has nothing to act on.
 */
export const OUTGOING_ID_PREFIX = 'outgoing:'

export function outgoingId(clientId: string): string {
  return `${OUTGOING_ID_PREFIX}${clientId}`
}

export function isOutgoingId(id: string): boolean {
  return id.startsWith(OUTGOING_ID_PREFIX)
}
