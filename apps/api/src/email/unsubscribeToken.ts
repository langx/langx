import { NOTIFICATION_TYPES, type NotificationType } from '@langx/shared'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Every kind, plus the "stop all of it" the confirmation page also offers,
 * plus the one scope that names no preference: `v1contact` is the link in the
 * single announcement sent to v1 accounts their owners deleted, where the
 * "user id" is the contact row and stopping means forgetting the address.
 */
export type UnsubscribeScope = NotificationType | 'all' | 'v1contact'

const VERSION = 'v1'

function signature(secret: string, userId: string, scope: UnsubscribeScope): string {
  return createHmac('sha256', secret).update(`${VERSION}:${userId}:${scope}`).digest('base64url')
}

/**
 * The credential in the footer of every notification email.
 *
 * It carries its own authority — no session, no login — because that is what
 * an unsubscribe link has to be. Somebody who left the app, forgot the
 * password and still gets mail must be able to stop it, and RFC 8058's
 * one-click is a machine following the link with no way to sign in at all.
 *
 * **It never expires.** A footer sits in an inbox for years and has to keep
 * working; CAN-SPAM's floor is thirty days after the send, which is a floor
 * rather than a design. The safety comes from the HMAC instead: 256 bits over
 * a 32-character secret, unguessable, and the worst it can be replayed to do
 * is switch off mail its holder already receives.
 */
export function signUnsubscribeToken(
  secret: string,
  userId: string,
  scope: UnsubscribeScope,
): string {
  return `${VERSION}.${userId}.${scope}.${signature(secret, userId, scope)}`
}

export function verifyUnsubscribeToken(
  secret: string,
  token: string | undefined,
): { userId: string; scope: UnsubscribeScope } | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 4) return null
  const [version, userId, scope, provided] = parts as [string, string, string, string]
  if (version !== VERSION || !userId) return null
  if (
    scope !== 'all' &&
    scope !== 'v1contact' &&
    !NOTIFICATION_TYPES.includes(scope as NotificationType)
  )
    return null

  const expected = signature(secret, userId, scope as UnsubscribeScope)
  // `timingSafeEqual` throws on a length mismatch rather than returning false,
  // and a token is attacker-supplied — the length check is not an optimisation.
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  if (!timingSafeEqual(a, b)) return null

  return { userId, scope: scope as UnsubscribeScope }
}

export function unsubscribeUrl(apiBaseUrl: string, token: string): string {
  return `${apiBaseUrl.replace(/\/$/, '')}/email/unsubscribe?token=${encodeURIComponent(token)}`
}
