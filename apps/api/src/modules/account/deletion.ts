import {
  ACCOUNT_DELETION_GRACE_DAYS,
  ERROR_CODES,
  type AccountDeletionStatus,
  type DataExport,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { authId } from '../../lib/authId'
import type { Conversation, Message } from '../chat/conversations'
import type { Profile } from '../profiles/profiles'

const GRACE_MS = ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000

export function purgeAtFor(deletedAt: Date): Date {
  return new Date(deletedAt.getTime() + GRACE_MS)
}

/**
 * Soft-deletes: sets `deletedAt`, which every listing already filters on.
 *
 * The account disappears from the product immediately — that is what the user
 * asked for and what the stores require to be possible in-app — while the data
 * survives the grace period so a change of mind is recoverable. An immediate
 * irreversible wipe would turn one angry tap into permanent loss.
 */
export async function requestDeletion(
  db: Db,
  userId: string,
  reason?: string,
): Promise<AccountDeletionStatus> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  const now = new Date()

  const updated = await profiles.findOneAndUpdate(
    { _id: userId },
    { $set: { deletedAt: now, ...(reason !== undefined ? { deletionReason: reason } : {}) } },
    { returnDocument: 'after' },
  )
  if (!updated) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Profile not found')

  // Every live session goes; the account must stop being usable at once.
  // `authId` because Better Auth stores ids as ObjectId — a string here
  // matches nothing and fails silently. See lib/authId.ts.
  await db.collection(COLLECTIONS.session).deleteMany({ userId: authId(userId) })
  // Stop pushing to a device whose owner just left.
  await db.collection(COLLECTIONS.devices).deleteMany({ userId })

  return {
    pending: true,
    deletedAt: now.toISOString(),
    purgeAt: purgeAtFor(now).toISOString(),
  }
}

/** Signing back in during the grace period is the cancel gesture. */
export async function cancelDeletion(db: Db, userId: string): Promise<AccountDeletionStatus> {
  const updated = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOneAndUpdate(
      { _id: userId },
      { $unset: { deletedAt: '', deletionReason: '' } },
      { returnDocument: 'after' },
    )
  if (!updated) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Profile not found')
  return { pending: false, deletedAt: null, purgeAt: null }
}

export async function deletionStatus(db: Db, userId: string): Promise<AccountDeletionStatus> {
  const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
  if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Profile not found')
  if (!profile.deletedAt) return { pending: false, deletedAt: null, purgeAt: null }
  return {
    pending: true,
    deletedAt: profile.deletedAt.toISOString(),
    purgeAt: purgeAtFor(profile.deletedAt).toISOString(),
  }
}

export interface PurgeResult {
  purged: number
  userIds: string[]
}

/**
 * Hard-deletes every account whose grace period has expired.
 *
 * What survives and why: messages the user *sent* are left in place with the
 * body replaced, because deleting them would silently rewrite the other
 * participant's history of a conversation they are also a party to. Everything
 * that is only about the deleted user — profile, devices, views, blocks,
 * ledger, aggregates, auth rows — goes completely.
 */
export async function purgeExpiredAccounts(
  db: Db,
  options: { now?: Date; limit?: number } = {},
): Promise<PurgeResult> {
  const now = options.now ?? new Date()
  const cutoff = new Date(now.getTime() - GRACE_MS)

  const expired = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find({ deletedAt: { $lte: cutoff } })
    .limit(options.limit ?? 100)
    .toArray()

  const userIds: string[] = []
  for (const profile of expired) {
    const userId = profile._id

    await db
      .collection<Message>(COLLECTIONS.messages)
      .updateMany(
        { senderId: userId },
        { $set: { body: '', deletedWithAccount: true }, $unset: { correction: '' } },
      )

    await Promise.all([
      db.collection(COLLECTIONS.profiles).deleteOne({ _id: userId as unknown as never }),
      db.collection(COLLECTIONS.devices).deleteMany({ userId }),
      db.collection(COLLECTIONS.profileViews).deleteMany({
        $or: [{ viewerId: userId }, { viewedId: userId }],
      }),
      db.collection(COLLECTIONS.blocks).deleteMany({
        $or: [{ blockerId: userId }, { blockedId: userId }],
      }),
      db.collection(COLLECTIONS.reports).deleteMany({ reporterId: userId }),
      db.collection(COLLECTIONS.tokenLedger).deleteMany({ userId }),
      db.collection(COLLECTIONS.tokenAggregates).deleteMany({ userId }),
      db.collection(COLLECTIONS.dailyActivity).deleteMany({ userId }),
      db.collection(COLLECTIONS.subscriptions).deleteMany({ userId }),
      db.collection(COLLECTIONS.appwriteIdMap).deleteMany({ userId }),
      // Better Auth's own rows. Deleting the `user` document is what makes the
      // email reusable and the account genuinely gone rather than orphaned.
      db.collection(COLLECTIONS.session).deleteMany({ userId: authId(userId) }),
      db.collection(COLLECTIONS.account).deleteMany({ userId: authId(userId) }),
      db.collection(COLLECTIONS.user).deleteOne({ _id: authId(userId) as unknown as never }),
    ])

    userIds.push(userId)
  }

  return { purged: userIds.length, userIds }
}

/**
 * Everything we hold about one user, as one JSON document.
 *
 * Only the user's *own* side: messages they sent, conversations they are in.
 * Exporting the other party's messages would hand one user a transcript of
 * someone else's words under the banner of their own data rights.
 */
export async function exportUserData(db: Db, userId: string): Promise<DataExport> {
  const [profile, conversations, messages, tokenLedger, subscriptions, blocks, views, devices] =
    await Promise.all([
      db.collection(COLLECTIONS.profiles).findOne({ _id: userId as unknown as never }),
      db
        .collection<Conversation>(COLLECTIONS.conversations)
        .find({ participants: userId })
        .toArray(),
      db.collection<Message>(COLLECTIONS.messages).find({ senderId: userId }).toArray(),
      db.collection(COLLECTIONS.tokenLedger).find({ userId }).toArray(),
      db.collection(COLLECTIONS.subscriptions).find({ userId }).toArray(),
      db.collection(COLLECTIONS.blocks).find({ blockerId: userId }).toArray(),
      db.collection(COLLECTIONS.profileViews).find({ viewerId: userId }).toArray(),
      db.collection(COLLECTIONS.devices).find({ userId }).toArray(),
    ])

  if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Profile not found')

  return {
    exportedAt: new Date().toISOString(),
    profile,
    conversations,
    messages,
    tokenLedger,
    subscriptions,
    blocks,
    profileViews: views,
    devices,
  }
}
