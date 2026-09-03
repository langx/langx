import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'

/**
 * One row per v1 account its owner deleted, written by
 * `scripts/precreate-v1-users.ts`. See `COLLECTIONS.v1DeletedContacts` for
 * why they exist at all: one announcement, then the collection goes.
 */
export interface DeletedContact {
  /** The Appwrite user id. */
  _id: string
  email: string
  name: string
  legacyUserId: string
  recordedAt: Date
  /** Claimed by the send, before the batch goes out. */
  sentAt?: Date
}

function contacts(db: Db) {
  return db.collection<DeletedContact>(COLLECTIONS.v1DeletedContacts)
}

/** Everyone the announcement has not yet gone to. */
export async function pendingDeletedContacts(db: Db, limit?: number): Promise<DeletedContact[]> {
  const cursor = contacts(db)
    .find({ sentAt: { $exists: false } })
    .sort({ _id: 1 })
  return limit ? cursor.limit(limit).toArray() : cursor.toArray()
}

/**
 * Claims a batch before it is sent, the same way `claimCampaignRecipients`
 * does: the conditional update is what makes a re-run unable to mail anybody
 * twice. Returns the ids actually claimed — a row claimed by a concurrent run,
 * or removed by its owner between the read and now, is simply not in the list.
 */
export async function claimDeletedContacts(
  db: Db,
  ids: string[],
  at: Date = new Date(),
): Promise<string[]> {
  const claimed: string[] = []
  for (const id of ids) {
    const result = await contacts(db).updateOne(
      { _id: id, sentAt: { $exists: false } },
      { $set: { sentAt: at } },
    )
    if (result.modifiedCount > 0) claimed.push(id)
  }
  return claimed
}

/** Undoes a claim whose send then failed, so a re-run retries exactly those. */
export async function releaseDeletedContacts(db: Db, ids: string[]): Promise<void> {
  if (ids.length === 0) return
  await contacts(db).updateMany({ _id: { $in: ids } }, { $unset: { sentAt: '' } })
}

/**
 * What the unsubscribe link in that one mail does. There is no preference to
 * switch off — these people have no account — so the only honest "stop" is
 * to forget the address. Idempotent: a second click finds nothing and that is
 * the right answer.
 */
export async function removeDeletedContact(db: Db, id: string): Promise<void> {
  await contacts(db).deleteOne({ _id: id })
}

export interface DropOutcome {
  dropped: boolean
  /** Why not, when not. */
  unsent: number
}

/**
 * The end of the collection's life, refused while anyone is still unsent —
 * dropping then would lose people the announcement was meant for, and the
 * script that calls this is the only thing that knows whether it finished.
 */
export async function dropDeletedContacts(db: Db): Promise<DropOutcome> {
  const unsent = await contacts(db).countDocuments({ sentAt: { $exists: false } })
  if (unsent > 0) return { dropped: false, unsent }
  const exists = await db.listCollections({ name: COLLECTIONS.v1DeletedContacts }).hasNext()
  if (exists) await db.dropCollection(COLLECTIONS.v1DeletedContacts)
  return { dropped: true, unsent: 0 }
}
