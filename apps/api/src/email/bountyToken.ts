import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * The credential in the email a bug report or feature request becomes that lets whoever reads it pay the
 * finder.
 *
 * Signed rather than stored, unlike `deletionTokens.ts`, because there is
 * nothing to store *about the token*: the thing that must not happen twice —
 * the payout — is already impossible twice over through the ledger's unique
 * `{userId, kind, refId}` index. `reportId` is that `refId`, and it is also
 * the `_id` of the report's row in `feedback`, so opening the link again pays
 * nothing and says so, a forwarded mail cannot pay a second time, and neither
 * can the operator panel, which reaches the same ledger row by the same id.
 *
 * **It is a capability: whoever holds the link can pay this one reporter, once,
 * within the range in `BOUNTY_MIN`/`MAX`.** That is the same trade the
 * account-deletion link makes — the mailbox is the authorisation — and it is
 * bounded here by the amount, by the single reporter it names, and by an
 * expiry, none of which that link has.
 */
const VERSION = 'v1'

/**
 * How long the link stays good.
 *
 * A report can sit in a mailbox for a while before anyone reproduces it, so an
 * hour would be a link that has always expired. A month is longer than the
 * decision takes and short enough that a mailbox archived for years is not a
 * standing payment instrument.
 */
export const BOUNTY_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

function signature(secret: string, userId: string, reportId: string, expiresAt: number): string {
  return createHmac('sha256', secret)
    .update(`${VERSION}:bounty:${userId}:${reportId}:${expiresAt}`)
    .digest('base64url')
}

export function signBountyToken(
  secret: string,
  input: { userId: string; reportId: string; expiresAt: number },
): string {
  const { userId, reportId, expiresAt } = input
  return [
    VERSION,
    userId,
    reportId,
    String(expiresAt),
    signature(secret, userId, reportId, expiresAt),
  ].join('.')
}

export function verifyBountyToken(
  secret: string,
  token: string | undefined,
  now: Date = new Date(),
): { userId: string; reportId: string } | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 5) return null
  const [version, userId, reportId, expiry, provided] = parts as [
    string,
    string,
    string,
    string,
    string,
  ]
  if (version !== VERSION || !userId || !reportId) return null

  const expiresAt = Number(expiry)
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now.getTime()) return null

  const expected = signature(secret, userId, reportId, expiresAt)
  // `timingSafeEqual` throws on a length mismatch rather than answering false,
  // and every part of this came from a URL somebody typed.
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  if (!timingSafeEqual(a, b)) return null

  return { userId, reportId }
}

export function bountyAwardUrl(apiBaseUrl: string, token: string): string {
  return `${apiBaseUrl.replace(/\/$/, '')}/feedback/award?token=${encodeURIComponent(token)}`
}
