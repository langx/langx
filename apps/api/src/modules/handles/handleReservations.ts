import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'

export interface HandleReservation {
  handle: string
  legacyEmailHash: string
  legacyUserId: string
  expiresAt: Date
  claimedBy?: string
  claimedAt?: Date
}

/** For the onboarding "your old handle @x is waiting" prompt — read-only, claims nothing. */
export async function findReservationForEmail(
  db: Db,
  legacyEmailHash: string,
): Promise<HandleReservation | null> {
  return db.collection<HandleReservation>(COLLECTIONS.handleReservations).findOne({
    legacyEmailHash,
    claimedBy: { $exists: false },
    expiresAt: { $gt: new Date() },
  })
}

export type HandleClaimResolution =
  /** No active reservation blocks this handle — caller proceeds to insert the profile. */
  | { kind: 'free' }
  /** This is the caller's own reservation and it was just atomically claimed. */
  | { kind: 'claimed' }
  /** Reserved for a different (or not-yet-matched) legacy email — refuse. */
  | { kind: 'reserved_for_other' }

/**
 * The one piece of this flow that has to be atomic: two people racing for
 * the same legacy handle must not both succeed. `findOneAndUpdate` with
 * `claimedBy` absent in the filter is the guard — only one request's update
 * can match a still-unclaimed document, so only one can set it.
 */
export async function resolveHandleClaim(
  db: Db,
  handle: string,
  userId: string,
  legacyEmailHash: string,
): Promise<HandleClaimResolution> {
  const reservations = db.collection<HandleReservation>(COLLECTIONS.handleReservations)

  const reservation = await reservations.findOne({ handle })
  if (!reservation) return { kind: 'free' }
  if (reservation.claimedBy || reservation.expiresAt <= new Date()) return { kind: 'free' }
  if (reservation.legacyEmailHash !== legacyEmailHash) return { kind: 'reserved_for_other' }

  const claimed = await reservations.findOneAndUpdate(
    { handle, claimedBy: { $exists: false }, expiresAt: { $gt: new Date() } },
    { $set: { claimedBy: userId, claimedAt: new Date() } },
  )

  // Someone else's request won the race between our findOne and this update.
  return claimed ? { kind: 'claimed' } : { kind: 'reserved_for_other' }
}

/**
 * Availability check for onboarding's live "is @handle free" indicator.
 * Best-effort by nature — like any such check, it can go stale between this
 * call and the real `POST /profiles` attempt, which is why that route still
 * relies on the unique indexes, not on this having said yes.
 */
export async function isHandleAvailable(
  db: Db,
  handle: string,
  legacyEmailHash: string | null,
): Promise<boolean> {
  const taken = await db.collection(COLLECTIONS.profiles).findOne({ handle })
  if (taken) return false

  const reservation = await db
    .collection<HandleReservation>(COLLECTIONS.handleReservations)
    .findOne({ handle })
  if (!reservation) return true
  if (reservation.claimedBy || reservation.expiresAt <= new Date()) return true
  return reservation.legacyEmailHash === legacyEmailHash
}
