import { notificationsAllowed } from '@langx/shared'
import type { Db, ObjectId } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { translator } from '../../i18n'
import type { Profile } from '../profiles/profiles'
import { sendPush, tokensByLocale, type PushSender } from '../push/devices'
import { claimOnce } from './ledger'

/**
 * The feed reacting to something somebody left in it.
 *
 * Until now the feed sent nothing at all: a person could write a sentence,
 * have it corrected by three strangers and hear about none of it unless they
 * happened to open the app. That is the largest hole on this channel, and it
 * is the one that costs a language exchange the most — a correction is the
 * whole product, and it arrives when its author is somewhere else.
 *
 * **Push only.** `social.email` is off by default: a follow is a small good
 * thing and a letter about one is not, and the corrections that would justify
 * mail deserve a digest rather than a message each. The switch exists on both
 * channels, so turning the email column on is a decision somebody can make
 * before there is a sender for it.
 *
 * Nothing here throws into its caller. These fire from the request that wrote
 * the follow or the correction, and a push service having a bad minute must
 * not turn a successful write into an error.
 */

export interface SocialNotifier {
  push: PushSender
  logger: { error: (obj: object, msg: string) => void }
}

async function pushSocial(
  db: Db,
  senders: SocialNotifier,
  userId: string,
  build: (t: ReturnType<typeof translator>) => { title: string; body: string },
  data: { postId?: string; handle?: string },
): Promise<void> {
  try {
    const profile = await db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ _id: userId }, { projection: { settings: 1, deletedAt: 1 } })
    if (!profile || profile.deletedAt) return
    if (!notificationsAllowed(profile.settings?.notifications, 'social', 'push')) return

    for (const [locale, tokens] of await tokensByLocale(db, userId)) {
      if (tokens.length === 0) continue
      const t = translator(locale)
      await sendPush(db, senders.push, {
        to: tokens,
        ...build(t),
        data: { kind: 'social', ...data },
      })
    }
  } catch (error) {
    senders.logger.error({ err: error, userId }, 'social push failed')
  }
}

/** "@sofia followed you." One per follower, ever — refollowing is not news. */
export async function notifyFollowed(
  db: Db,
  senders: SocialNotifier,
  input: { followerId: string; followeeId: string },
): Promise<void> {
  if (input.followerId === input.followeeId) return
  if (!(await claimOnce(db, 'social.follow', input.followeeId, input.followerId))) return

  const follower = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOne({ _id: input.followerId }, { projection: { displayName: 1, handle: 1 } })
  if (!follower) return
  const name = follower.displayName || follower.handle

  await pushSocial(
    db,
    senders,
    input.followeeId,
    (t) => ({ title: t('push.social.followTitle', { name }), body: t('push.social.followBody') }),
    { handle: follower.handle },
  )
}

/**
 * "Somebody corrected your sentence" — a correction, a recorded answer or a
 * comment, all three on a post its author is not looking at.
 *
 * Throttled to one push per post per hour, in the ledger. Three people
 * correcting the same sentence within a minute of each other is the good
 * case, not the rare one, and three buzzes about it is how the switch gets
 * turned off. The first is the one that matters; the rest are waiting in the
 * app.
 */
export type FeedReply = 'correction' | 'answer' | 'comment'

export async function notifyPostReply(
  db: Db,
  senders: SocialNotifier,
  input: { postId: ObjectId; authorId: string; responderId: string; kind: FeedReply },
  now: Date = new Date(),
): Promise<void> {
  if (input.authorId === input.responderId) return
  const hour = now.toISOString().slice(0, 13)
  const postId = input.postId.toHexString()
  if (!(await claimOnce(db, 'social.postReply', input.authorId, `${postId}:${hour}`))) return

  const responder = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOne({ _id: input.responderId }, { projection: { displayName: 1, handle: 1 } })
  const name = responder?.displayName || responder?.handle || ''

  await pushSocial(
    db,
    senders,
    input.authorId,
    (t) => ({
      title: t(`push.social.${input.kind}Title` as never, { name }),
      body: t(`push.social.${input.kind}Body` as never),
    }),
    { postId },
  )
}

/** Likeable things whose author this pass has to find. */
const LIKE_TARGETS = [
  { type: 'post', collection: COLLECTIONS.posts, author: 'authorId' },
  { type: 'correction', collection: COLLECTIONS.postCorrections, author: 'authorId' },
  { type: 'answer', collection: COLLECTIONS.pronunciationAnswers, author: 'authorId' },
] as const

interface LikeRow {
  targetType: string
  targetId: ObjectId
  createdAt: Date
}

/**
 * "Your post got N likes", once a day rather than once a like.
 *
 * A like is the cheapest thing anybody can do here, which is exactly why it
 * must not buzz: a post that does well would otherwise be twenty
 * notifications about twenty taps. Batched to a day and claimed per day, so
 * the number in the message is the day's total and there is one of them.
 *
 * The window is the last twenty-four hours rather than the local day, because
 * the pass has no reason to care where the reader is — the count is the
 * count, and waiting for a local midnight would delay it for no gain.
 */
export async function runLikesRoundUpPass(
  db: Db,
  sender: PushSender,
  now: Date = new Date(),
): Promise<{ sent: number }> {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const likes = await db
    .collection<LikeRow>(COLLECTIONS.likes)
    .find({ createdAt: { $gte: since } }, { projection: { targetType: 1, targetId: 1 } })
    .toArray()
  if (likes.length === 0) return { sent: 0 }

  // Count per target, then resolve each target's author — two queries per
  // likeable kind rather than one per like.
  const counts = new Map<string, { type: string; id: ObjectId; count: number }>()
  for (const like of likes) {
    const key = `${like.targetType}:${like.targetId.toHexString()}`
    const seen = counts.get(key)
    if (seen) seen.count++
    else counts.set(key, { type: like.targetType, id: like.targetId, count: 1 })
  }

  const perAuthor = new Map<string, { count: number; postId: string }>()
  for (const target of LIKE_TARGETS) {
    const ids = [...counts.values()].filter((c) => c.type === target.type)
    if (ids.length === 0) continue
    const rows = await db
      .collection<{ _id: ObjectId; authorId: string; postId?: ObjectId }>(target.collection)
      .find({ _id: { $in: ids.map((c) => c.id) } }, { projection: { authorId: 1, postId: 1 } })
      .toArray()
    for (const row of rows) {
      const counted = ids.find((c) => c.id.equals(row._id))
      if (!counted) continue
      const existing = perAuthor.get(row.authorId)
      // A correction's likes land on the post it corrects, which is the
      // screen that shows it.
      const postId = (row.postId ?? row._id).toHexString()
      if (existing) existing.count += counted.count
      else perAuthor.set(row.authorId, { count: counted.count, postId })
    }
  }

  const day = now.toISOString().slice(0, 10)
  let sent = 0
  for (const [authorId, { count, postId }] of perAuthor) {
    if (!(await claimOnce(db, 'social.likes', authorId, day))) continue
    await pushSocial(
      db,
      { push: sender, logger: console },
      authorId,
      (t) => ({
        title: t('push.social.likesTitle', { count }),
        body: t('push.social.likesBody'),
      }),
      { postId },
    )
    sent++
  }
  return { sent }
}
