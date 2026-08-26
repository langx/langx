import { createHash } from 'node:crypto'

/**
 * Turns a v1 email into `handleReservations.legacyEmailHash`. Used by both
 * the ETL import (scripts/migrate-appwrite.ts) and the live claim check —
 * they must normalize and hash identically or a legitimate v1 user's
 * verified email will never match their own reservation.
 *
 * Hashed rather than stored in the clear: the reservation only needs to
 * answer "does this verified email match", never "what was the v1 email" —
 * carrying the plaintext would be unnecessary PII in a public-repo-adjacent
 * database dump.
 */
export function hashLegacyEmail(email: string, salt: string): string {
  const normalized = email.trim().toLowerCase()
  return createHash('sha256').update(salt).update(normalized).digest('hex')
}
