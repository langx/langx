import {
  ACCOUNT_DELETION_GRACE_DAYS,
  ERROR_CODES,
  type AccountDeletionStatus,
  type DataExport,
} from '@langx/shared'
import { randomUUID } from 'node:crypto'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { authId } from '../../lib/authId'
import type { StorageProvider } from '../../storage/StorageProvider'
import { supportsPut } from '../../storage/StorageProvider'
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
  /** Images removed from the bucket. Zero when storage is not configured. */
  objectsDeleted: number
}

/**
 * Hard-deletes every account whose grace period has expired.
 *
 * What survives and why:
 *
 * - Messages the user *sent* stay, with the body cleared — deleting them would
 *   silently rewrite the other participant's history of a conversation they
 *   are also a party to.
 * - The token ledger stays, with its identity replaced by a random id stored
 *   nowhere else. That keeps an audit trail of the economy (totals still
 *   reconcile) while making the rows genuinely anonymous. The *aggregates* are
 *   deleted, which is what removes the account from every leaderboard.
 * - Everything else — profile, devices, views, blocks, subscriptions, auth
 *   rows, and the images in the bucket — goes completely.
 */
export async function purgeExpiredAccounts(
  db: Db,
  options: { now?: Date; limit?: number; storage?: StorageProvider } = {},
): Promise<PurgeResult> {
  const now = options.now ?? new Date()
  const cutoff = new Date(now.getTime() - GRACE_MS)

  const expired = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find({ deletedAt: { $lte: cutoff } })
    .limit(options.limit ?? 100)
    .toArray()

  const userIds: string[] = []
  let objectsDeleted = 0

  for (const profile of expired) {
    const userId = profile._id

    // Their images have to leave the bucket too. Deleting the documents while
    // the files stay publicly fetchable by URL would make "permanently
    // removed" false, which is what the privacy policy promises.
    if (options.storage && supportsPut(options.storage)) {
      // Attachments they sent, too. The message row survives with its body
      // cleared (it is half of someone else's conversation), but the bytes
      // behind it are theirs alone and must go — the same reasoning that
      // applies to the avatar.
      const sentMedia = await db
        .collection<Message>(COLLECTIONS.messages)
        .find({ senderId: userId, media: { $exists: true } }, { projection: { media: 1 } })
        .toArray()

      const urls = [
        profile.avatarUrl,
        ...(profile.photos ?? []).map((p) => p.url),
        ...sentMedia.map((m) => m.media?.url),
      ]
      for (const url of urls) {
        if (!url) continue
        const key = options.storage.keyFromPublicUrl(url)
        // A URL outside our bucket is not ours to delete. It should not be
        // possible — both upload paths verify the prefix — but a purge is the
        // wrong place to find out by deleting someone else's object.
        if (!key) continue
        try {
          await options.storage.deleteObject(key)
          objectsDeleted++
        } catch {
          // One unreachable object must not strand the whole purge. The row is
          // still removed and the next run finds nothing left to delete, so the
          // failure mode is an orphaned file rather than an account that never
          // gets purged.
        }
      }
    }

    await db.collection<Message>(COLLECTIONS.messages).updateMany(
      { senderId: userId },
      // `media` goes with the body: the object behind it has just been
      // deleted, so leaving the reference would render a broken image.
      { $set: { body: '', deletedWithAccount: true }, $unset: { correction: '', media: '' } },
    )

    /**
     * The chat list reads `lastMessage.body` verbatim, and nothing has ever
     * recomputed it — so blanking the messages above left the purged user's
     * last sentence sitting in the other person's list, which is precisely the
     * text a purge is supposed to remove. Patched rather than recomputed, for
     * the same reason a withdrawal is: the newest message is still that row.
     */
    await db
      .collection<Conversation>(COLLECTIONS.conversations)
      .updateMany(
        { participants: userId, 'lastMessage.senderId': userId },
        { $set: { 'lastMessage.body': '', 'lastMessage.deleted': true } },
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
      // Likes this account left. Not the ones it *received* — those are counts
      // on content that survives the author, the same way a post outlives the
      // account that wrote it.
      db.collection(COLLECTIONS.likes).deleteMany({ userId }),
      // The ledger survives as an audit trail, with the identity removed: a
      // fresh random id per purge, stored nowhere else, so the rows stay
      // linkable to each other and to nobody. The aggregates *are* deleted,
      // which is what drops the account off every leaderboard.
      db
        .collection(COLLECTIONS.tokenLedger)
        .updateMany({ userId }, { $set: { userId: `deleted:${randomUUID()}` } }),
      db.collection(COLLECTIONS.tokenAggregates).deleteMany({ userId }),
      db.collection(COLLECTIONS.dailyActivity).deleteMany({ userId }),
      db.collection(COLLECTIONS.subscriptions).deleteMany({ userId }),
      // Better Auth's own rows. Deleting the `user` document is what makes the
      // email reusable and the account genuinely gone rather than orphaned.
      db.collection(COLLECTIONS.session).deleteMany({ userId: authId(userId) }),
      db.collection(COLLECTIONS.account).deleteMany({ userId: authId(userId) }),
      db.collection(COLLECTIONS.user).deleteOne({ _id: authId(userId) as unknown as never }),
    ])

    userIds.push(userId)
  }

  return { purged: userIds.length, userIds, objectsDeleted }
}

/**
 * Everything we hold about one user, as one JSON document.
 *
 * Only the user's *own* side: messages they sent, conversations they are in.
 * Exporting the other party's messages would hand one user a transcript of
 * someone else's words under the banner of their own data rights.
 */
export async function exportUserData(db: Db, userId: string): Promise<DataExport> {
  const [
    profile,
    conversations,
    messages,
    tokenLedger,
    subscriptions,
    blocks,
    views,
    devices,
    posts,
    postCorrections,
    likes,
  ] = await Promise.all([
    db.collection(COLLECTIONS.profiles).findOne({ _id: userId as unknown as never }),
    db.collection<Conversation>(COLLECTIONS.conversations).find({ participants: userId }).toArray(),
    db.collection<Message>(COLLECTIONS.messages).find({ senderId: userId }).toArray(),
    db.collection(COLLECTIONS.tokenLedger).find({ userId }).toArray(),
    db.collection(COLLECTIONS.subscriptions).find({ userId }).toArray(),
    db.collection(COLLECTIONS.blocks).find({ blockerId: userId }).toArray(),
    db.collection(COLLECTIONS.profileViews).find({ viewerId: userId }).toArray(),
    db.collection(COLLECTIONS.devices).find({ userId }).toArray(),
    db.collection(COLLECTIONS.posts).find({ authorId: userId }).toArray(),
    db.collection(COLLECTIONS.postCorrections).find({ authorId: userId }).toArray(),
    db.collection(COLLECTIONS.likes).find({ userId }).toArray(),
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
    posts,
    postCorrections,
    likes,
  }
}
