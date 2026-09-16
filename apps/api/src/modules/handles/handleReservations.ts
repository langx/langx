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

/**
 * What an active reservation says about a handle, without touching it.
 *
 * A **read**, deliberately. This used to be one function that answered the
 * question and claimed the reservation in the same call, and every caller
 * asked it before it knew the handle could actually be written — so a request
 * that was then refused (a running cooldown, a name somebody else is still
 * reachable at, a duplicate key) left `claimedBy` set on a reservation for a
 * handle nobody got. Nothing releases a claim, and `isHandleAvailable` reads a
 * claimed reservation as free, so the refusal handed a returning v1 user's own
 * name to the next person who asked for it.
 *
 * Asking and taking are therefore two calls now: this one to decide, and
 * `markReservationClaimed` once the handle is actually written.
 */
export type ReservationVerdict =
  /** No active reservation blocks this handle — caller proceeds. */
  | 'free'
  /** Reserved for this caller's own v1 account: theirs to take, reserved list and all. */
  | 'mine'
  /** Reserved for a different (or not-yet-matched) legacy email — refuse. */
  | 'reserved_for_other'

export async function reservationVerdict(
  db: Db,
  handle: string,
  legacyEmailHash: string,
): Promise<ReservationVerdict> {
  const reservation = await db
    .collection<HandleReservation>(COLLECTIONS.handleReservations)
    .findOne({ handle })
  if (!reservation) return 'free'
  if (reservation.claimedBy || reservation.expiresAt <= new Date()) return 'free'
  return reservation.legacyEmailHash === legacyEmailHash ? 'mine' : 'reserved_for_other'
}

/**
 * Records that the reservation has been spent — called *after* the handle has
 * been written to the profile, never before.
 *
 * `claimedBy: { $exists: false }` still guards the write, so two requests that
 * race can only have one of them mark it. That is no longer what stops two
 * people ending up with one handle, though: `handle_unique` on `profiles` is,
 * and it was always the only thing that could be, because the profile write is
 * where the handle actually changes hands. This is bookkeeping about which
 * reservation was consumed and by whom.
 *
 * Failing here is therefore harmless and safe in the one direction that
 * matters: the handle is already on the profile, so `isHandleAvailable` reads
 * it as taken through `handle` rather than through the reservation.
 */
export async function markReservationClaimed(
  db: Db,
  handle: string,
  userId: string,
): Promise<void> {
  await db
    .collection<HandleReservation>(COLLECTIONS.handleReservations)
    .updateOne(
      { handle, claimedBy: { $exists: false }, expiresAt: { $gt: new Date() } },
      { $set: { claimedBy: userId, claimedAt: new Date() } },
    )
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
  forUserId?: string,
): Promise<boolean> {
  /*
   * `previousHandle` as well as `handle`: an account that changed its name is
   * still reachable at the old one, and the whole point of keeping it is that
   * nobody else can be handed it. One query over two indexed fields rather
   * than two round-trips. The asker's own old name is the exception — it is
   * theirs to go back to, and `changeHandle` allows exactly that.
   */
  // Typed inline: `_id` is our string id, not the ObjectId the untyped
  // collection assumes, and `$ne` against it has to say so.
  const taken = await db
    .collection<{ _id: string; handle: string; previousHandle?: string }>(COLLECTIONS.profiles)
    .findOne({
      $or: [
        { handle },
        forUserId
          ? { previousHandle: handle, _id: { $ne: forUserId } }
          : { previousHandle: handle },
      ],
    })
  if (taken) return false

  const reservation = await db
    .collection<HandleReservation>(COLLECTIONS.handleReservations)
    .findOne({ handle })
  if (!reservation) return true
  if (reservation.claimedBy || reservation.expiresAt <= new Date()) return true
  return reservation.legacyEmailHash === legacyEmailHash
}
