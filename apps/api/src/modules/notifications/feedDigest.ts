import { localDayKey, type Locale } from '@langx/shared'
import { ObjectId, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { feedDigestSection as buildSection } from '../../email/templates'
import type { Post } from '../feed/documents'
import type { Profile } from '../profiles/profiles'
import type { DigestCandidate } from './digest'
import { claimOnce } from './ledger'

const DAY_MS = 24 * 60 * 60 * 1000

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
 * posts, gathered once for the whole tick.
 *
 * Driven from the replies rather than from the profiles, and that is the
 * reason this is a collector rather than a per-reader query: on any given day
 * the people with something to read are a handful, and asking each profile in
 * turn whether anybody answered it would be a collection scan per reader.
 * One pass over a day of replies answers it for everybody at once.
 */
export async function collectFeedReplies(
  db: Db,
  now: Date,
): Promise<Map<string, FeedDigestItem[]>> {
  const since = new Date(now.getTime() - DAY_MS)

  const [corrections, answers, comments] = await Promise.all([
    repliesSince(db, COLLECTIONS.postCorrections, since),
    repliesSince(db, COLLECTIONS.pronunciationAnswers, since),
    repliesSince(db, COLLECTIONS.postComments, since),
  ])

  const byPost = new Map<string, { corrections: number; answers: number; comments: number }>()
  const bump = (postId: ObjectId, key: 'corrections' | 'answers' | 'comments') => {
    const id = postId.toHexString()
    const seen = byPost.get(id) ?? { corrections: 0, answers: 0, comments: 0 }
    seen[key]++
    byPost.set(id, seen)
  }
  for (const row of corrections) bump(row.postId, 'corrections')
  for (const row of answers) bump(row.postId, 'answers')
  for (const row of comments) bump(row.postId, 'comments')

  const perAuthor = new Map<string, FeedDigestItem[]>()
  if (byPost.size === 0) return perAuthor

  const posts = await db
    .collection<Post>(COLLECTIONS.posts)
    .find(
      // The keys came out of `ObjectId.toHexString`, so this cannot throw.
      { _id: { $in: [...byPost.keys()].map((id) => new ObjectId(id)) } },
      { projection: { authorId: 1, body: 1 } },
    )
    .toArray()

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
  return perAuthor
}

/**
 * One reader's share of that, as a section.
 *
 * One claim per local day. A reply that lands after the mail has gone waits
 * for tomorrow's — the push already said it, and a second letter about the
 * same post on the same day is how a digest becomes noise.
 */
export function feedRepliesSection(
  db: Db,
  profile: Profile,
  items: FeedDigestItem[] | undefined,
  now: Date,
): DigestCandidate | null {
  if (!items || items.length === 0) return null

  // Busiest first: the post with the most to read is the one worth naming.
  const ranked = [...items].sort(
    (a, b) => b.corrections + b.answers + b.comments - (a.corrections + a.answers + a.comments),
  )
  const named = ranked.slice(0, FEED_DIGEST_MAX_POSTS)
  const day = localDayKey(now, profile.timezone ?? 'UTC')

  return {
    // The corrections are what the sentence was posted for.
    trigger: true,
    claim: () => claimOnce(db, 'feedDigest', profile._id, day),
    build: (locale: Locale) =>
      buildSection(locale, { items: named, morePosts: ranked.length - named.length }),
  }
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
