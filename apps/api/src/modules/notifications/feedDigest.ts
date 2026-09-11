import {
  NOTIFICATION_EMAIL_LOCAL_HOURS,
  localDayKey,
  localHour,
  notificationsAllowed,
} from '@langx/shared'
import { ObjectId, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { sendNotificationEmail, type NotificationEmailContext } from '../../email/notify'
import { feedDigestEmail } from '../../email/templates'
import type { Post } from '../feed/documents'
import type { Profile } from '../profiles/profiles'
import { claimOnce } from './ledger'

const DAY_MS = 24 * 60 * 60 * 1000

/** The hour, on the reader's own clock, the day's corrections are worth reading. */
export const FEED_DIGEST_LOCAL_HOUR = 19

/** Named in the mail before it says "and N more". */
export const FEED_DIGEST_MAX_POSTS = 3

export interface FeedDigestItem {
  /** The sentence that was answered, trimmed for a subject line. */
  excerpt: string
  postId: string
  corrections: number
  answers: number
  comments: number
}

/**
 * "Three people corrected your sentence" — the day's replies to somebody's
 * posts, in one letter.
 *
 * The push half of `social` fires on the reply and is throttled to one an
 * hour; this is the other half, and the two answer different questions. A
 * push says *something happened, look now*; a digest says *here is what the
 * day amounted to*, which is the one worth reading when the corrections are
 * the reason somebody posted at all.
 *
 * Evening rather than morning: a sentence posted in the morning has had the
 * day to be answered, and a correction is something people sit down with.
 *
 * One claim per local day. A reply that lands after the digest has gone waits
 * for tomorrow's — the push already said it, and a second letter about the
 * same post on the same day is how a digest becomes noise.
 */
export async function runFeedDigestPass(
  db: Db,
  ctx: NotificationEmailContext,
  now: Date = new Date(),
): Promise<{ sent: number }> {
  const since = new Date(now.getTime() - DAY_MS)

  // Driven from the replies rather than from the profiles: on any given day
  // the people with something to read are a handful, and scanning every
  // profile to find them would be a collection scan per tick.
  const [corrections, answers, comments] = await Promise.all([
    repliesSince(db, COLLECTIONS.postCorrections, since),
    repliesSince(db, COLLECTIONS.pronunciationAnswers, since),
    repliesSince(db, COLLECTIONS.postComments, since),
  ])

  const byPost = new Map<string, { corrections: number; answers: number; comments: number }>()
  const bump = (
    postId: ObjectId,
    key: 'corrections' | 'answers' | 'comments',
    authorId: string,
  ) => {
    const id = postId.toHexString()
    const seen = byPost.get(id) ?? { corrections: 0, answers: 0, comments: 0 }
    seen[key]++
    byPost.set(id, seen)
    return authorId
  }
  for (const row of corrections) bump(row.postId, 'corrections', row.authorId)
  for (const row of answers) bump(row.postId, 'answers', row.authorId)
  for (const row of comments) bump(row.postId, 'comments', row.authorId)
  if (byPost.size === 0) return { sent: 0 }

  const posts = await db
    .collection<Post>(COLLECTIONS.posts)
    .find(
      // The keys came out of `ObjectId.toHexString`, so this cannot throw.
      { _id: { $in: [...byPost.keys()].map((id) => new ObjectId(id)) } },
      { projection: { authorId: 1, body: 1 } },
    )
    .toArray()

  /** Each author's own posts, with what the day did to them. */
  const perAuthor = new Map<string, FeedDigestItem[]>()
  for (const post of posts) {
    const counts = byPost.get(post._id.toHexString())
    if (!counts) continue
    const items = perAuthor.get(post.authorId) ?? []
    items.push({
      excerpt: post.body.trim().slice(0, 90),
      postId: post._id.toHexString(),
      ...counts,
    })
    perAuthor.set(post.authorId, items)
  }

  let sent = 0
  for (const [authorId, items] of perAuthor) {
    const profile = await db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ _id: authorId }, { projection: { settings: 1, timezone: 1, deletedAt: 1 } })
    if (!profile || profile.deletedAt) continue
    if (!notificationsAllowed(profile.settings?.notifications, 'social', 'email')) continue

    const zone = profile.timezone ?? 'UTC'
    const hour = localHour(now, zone)
    if (hour < FEED_DIGEST_LOCAL_HOUR) continue
    if (hour > NOTIFICATION_EMAIL_LOCAL_HOURS.latest) continue
    if (!(await claimOnce(db, 'feedDigest', authorId, localDayKey(now, zone)))) continue

    // Busiest first: the post with the most to read is the one worth naming.
    const ranked = [...items].sort(
      (a, b) => b.corrections + b.answers + b.comments - (a.corrections + a.answers + a.comments),
    )
    const named = ranked.slice(0, FEED_DIGEST_MAX_POSTS)
    const outcome = await sendNotificationEmail(db, ctx, {
      userId: authorId,
      type: 'social',
      build: (locale, unsubscribe) =>
        feedDigestEmail(locale, {
          items: named,
          morePosts: ranked.length - named.length,
          unsubscribe,
        }),
    })
    if (outcome === 'sent') sent++
  }

  return { sent }
}

interface ReplyRow {
  postId: ObjectId
  authorId: string
}

async function repliesSince(db: Db, collection: string, since: Date): Promise<ReplyRow[]> {
  return db
    .collection<ReplyRow>(collection)
    .find({ createdAt: { $gte: since } }, { projection: { postId: 1, authorId: 1 } })
    .toArray()
}
