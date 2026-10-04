import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * A ticket that lets one phone turn down one call, and do nothing else.
 *
 * It rides in the push that makes the phone ring, because the code that draws
 * the system's call screen runs before the app does and often instead of it:
 * a locked iPhone cannot read the session cookie out of the Keychain, and an
 * Android phone woken by a push has no JavaScript running to read it at all.
 * "Decline" on that screen still has to reach the server, or the caller goes
 * on listening to a ring that somebody already answered with a no.
 *
 * So the ticket is narrow on every axis. It names one call and the one person
 * who is being rung by it; it expires a minute after the ring does; and the
 * only route that accepts it (`POST /calls/:id/decline`) can only turn that
 * call down while it is still ringing. Stolen, it is worth one declined call
 * that was about to be missed anyway.
 *
 * Signed with the auth secret under its own label. Rotating that secret
 * invalidates the tickets of calls ringing at that instant and nothing else —
 * unlike the unsubscribe links, these do not live in anybody's inbox.
 */
const LABEL = 'langx-call-token:v1'

/** How long past the end of ringing a ticket is still honoured. */
export const CALL_TOKEN_GRACE_SECONDS = 60

function signature(secret: string, callId: string, userId: string, expires: number): Buffer {
  return createHmac('sha256', secret).update(`${LABEL}:${callId}:${userId}:${expires}`).digest()
}

export function signCallToken(
  secret: string,
  call: { callId: string; userId: string; expiresAt: Date },
): string {
  const expires = Math.floor(call.expiresAt.getTime() / 1000)
  return `${expires}.${signature(secret, call.callId, call.userId, expires).toString('base64url')}`
}

/**
 * Whether this ticket was issued for this call and this person, and is still
 * inside its minute.
 *
 * The call and the person are read by the caller from the call's own record,
 * never from the request: the ticket proves it matches them, it does not get
 * to say who they are.
 */
export function verifyCallToken(
  secret: string,
  token: string,
  call: { callId: string; userId: string },
  now: Date = new Date(),
): boolean {
  const dot = token.indexOf('.')
  if (dot <= 0) return false
  const expires = Number(token.slice(0, dot))
  if (!Number.isInteger(expires) || expires * 1000 < now.getTime()) return false

  const given = Buffer.from(token.slice(dot + 1), 'base64url')
  const expected = signature(secret, call.callId, call.userId, expires)
  // Length first: `timingSafeEqual` throws on a mismatch rather than answering.
  return given.length === expected.length && timingSafeEqual(given, expected)
}
