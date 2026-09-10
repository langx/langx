import { createHmac, timingSafeEqual } from 'node:crypto'
import { REVIEW_KINDS, type ReviewKind } from '@langx/shared'

/**
 * The credential in a report email that lets whoever reads it suspend the
 * account — and, in the appeal email that may follow, shorten or lift it.
 *
 * Signed rather than stored, like `bountyToken.ts`, and for the same reason:
 * there is nothing to store. The report already has a row and the suspension
 * already has a field; a token table would be a third thing to keep in step
 * with them.
 *
 * **It is a capability: whoever holds the link can decide this one report, or
 * this one appeal, within the bounds the page offers.** The mailbox is the
 * authorisation — the same trade the bounty link and the account-deletion
 * link make — and it is bounded here by the single account it names, by the
 * `kind`, which fixes which of the six actions it can drive, and by an expiry.
 *
 * A suspension is reversible from the appeal link, which is the honest answer
 * to "what if the mail is forwarded": the worst a stolen link can do is
 * something a person can undo, and a second decision replaces the first
 * rather than stacking.
 */
const VERSION = 'v1'

/**
 * How long the link stays good.
 *
 * The same month `BOUNTY_TOKEN_TTL_MS` allows, for the same reason: a report
 * can sit unread for days before anybody has time to judge it, and a link
 * that has always expired is a review that never happens. A month is also
 * short enough that a mailbox archived for years is not a standing power over
 * somebody's account.
 */
export const REVIEW_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** Appeals raised against a suspension that had no report behind it. */
const NO_REPORT = '-'

export interface ReviewClaim {
  kind: ReviewKind
  userId: string
  /** The report this decides, or `null` for an appeal with none behind it. */
  reportId: string | null
}

function signature(
  secret: string,
  kind: string,
  userId: string,
  reportId: string,
  expiresAt: number,
): string {
  return createHmac('sha256', secret)
    .update(`${VERSION}:review:${kind}:${userId}:${reportId}:${expiresAt}`)
    .digest('base64url')
}

export function signReviewToken(
  secret: string,
  input: { kind: ReviewKind; userId: string; reportId?: string | null; expiresAt: number },
): string {
  const reportId = input.reportId ?? NO_REPORT
  return [
    VERSION,
    input.kind,
    input.userId,
    reportId,
    String(input.expiresAt),
    signature(secret, input.kind, input.userId, reportId, input.expiresAt),
  ].join('.')
}

export function verifyReviewToken(
  secret: string,
  token: string | undefined,
  now: Date = new Date(),
): ReviewClaim | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 6) return null
  const [version, kind, userId, reportId, expiry, provided] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
  ]
  if (version !== VERSION || !userId || !reportId) return null
  if (!(REVIEW_KINDS as readonly string[]).includes(kind)) return null

  const expiresAt = Number(expiry)
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now.getTime()) return null

  const expected = signature(secret, kind, userId, reportId, expiresAt)
  // `timingSafeEqual` throws on a length mismatch rather than answering false,
  // and every part of this came from a URL somebody typed.
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  if (!timingSafeEqual(a, b)) return null

  return { kind: kind as ReviewKind, userId, reportId: reportId === NO_REPORT ? null : reportId }
}

export function reviewUrl(apiBaseUrl: string, token: string): string {
  return `${apiBaseUrl.replace(/\/$/, '')}/moderation/review?token=${encodeURIComponent(token)}`
}
