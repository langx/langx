import { BADGE_CALL_MIN_SECONDS } from '@langx/shared'
import type { Db, ObjectId } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'

/**
 * The six counts behind the badge kinds added with the v3 shelf, each read
 * from what the database already records. Nothing here writes: a badge is
 * derived, never stored (see `BADGES`), so these are as idempotent as a read
 * can be, and a badge "awarded" twice is the same count read twice.
 *
 * Every one of them is retroactive by construction — it counts what was done
 * before the badge existed — and monotonic in the sense `BADGES` asks for,
 * with the caveats each function names: a count read from rows somebody can
 * delete can fall back, and that is accepted where the alternative was a
 * second, stored copy of the same fact.
 *
 * Each read rides an index that already exists; the comment on each says
 * which, because a count added here runs once per profile in the evening
 * round-up and must never become a collection scan.
 */

/** Echo reviews done, whatever the grade. `owner_recent` on `echoReviews`. */
export async function countEchoReviews(db: Db, userId: string): Promise<number> {
  return db.collection(COLLECTIONS.echoReviews).countDocuments({ userId })
}

/**
 * Partners who wrote about you. A row the profile's owner hid still counts —
 * hiding it is a choice about the page, not a denial that it was written —
 * and a row a moderator took down does not. `subject_recent`.
 */
export async function countTestimonialsAbout(db: Db, userId: string): Promise<number> {
  return db
    .collection(COLLECTIONS.testimonials)
    .countDocuments({ subjectId: userId, moderatorHiddenAt: { $exists: false } })
}

/**
 * Calls of at least `BADGE_CALL_MIN_SECONDS`, placed or answered.
 *
 * Read from the call rows in the threads, not from `calls`: that collection
 * keeps a call for thirty days and the thread keeps it for good. The row's
 * sender is whoever placed the call, so a call you answered is a row in one
 * of your conversations that somebody else sent.
 *
 * Placed: `sender_type`. Answered: `participants`, then
 * `conversation_type_created` across those conversations.
 */
export async function countLongCalls(db: Db, userId: string): Promise<number> {
  const long = { type: 'call', 'call.durationSeconds': { $gte: BADGE_CALL_MIN_SECONDS } }
  const conversations = await db
    .collection<{ _id: ObjectId }>(COLLECTIONS.conversations)
    .find({ participants: userId }, { projection: { _id: 1 } })
    .toArray()
  const [placed, answered] = await Promise.all([
    db.collection(COLLECTIONS.messages).countDocuments({ senderId: userId, ...long }),
    conversations.length === 0
      ? 0
      : db.collection(COLLECTIONS.messages).countDocuments({
          conversationId: { $in: conversations.map((c) => c._id) },
          senderId: { $ne: userId },
          ...long,
        }),
  ])
  return placed + answered
}

/**
 * Different people you corrected: authors of posts you corrected or whose
 * pronunciation request you answered, and the other person in each thread
 * where you sent a correction. The same person twice counts once, and
 * yourself never.
 *
 * `author_recent` on `postCorrections` and `pronunciationAnswers`, the posts
 * by `_id`, `sender_type` on `messages`, and the conversations by `_id`. A
 * post deleted since drops its author out of this — the one way the number
 * can fall, accepted rather than storing a second copy of who was helped.
 */
export async function countPeopleHelped(db: Db, userId: string): Promise<number> {
  const [correctedPosts, answeredPosts, threads] = await Promise.all([
    db
      .collection<{ postId: ObjectId; authorId: string }>(COLLECTIONS.postCorrections)
      .distinct('postId', { authorId: userId }),
    db
      .collection<{ postId: ObjectId; authorId: string }>(COLLECTIONS.pronunciationAnswers)
      .distinct('postId', { authorId: userId }),
    db
      .collection<{ conversationId: ObjectId; senderId: string; type: string }>(
        COLLECTIONS.messages,
      )
      .distinct('conversationId', { senderId: userId, type: 'correction' }),
  ])
  const postIds = [...correctedPosts, ...answeredPosts]
  const [authors, pairs] = await Promise.all([
    postIds.length === 0
      ? []
      : db.collection(COLLECTIONS.posts).distinct('authorId', { _id: { $in: postIds } }),
    threads.length === 0
      ? []
      : db
          .collection<{ participants: string[] }>(COLLECTIONS.conversations)
          .find({ _id: { $in: threads } }, { projection: { participants: 1 } })
          .toArray(),
  ])
  const people = new Set<string>(authors.map(String))
  for (const pair of pairs) for (const id of pair.participants) people.add(id)
  people.delete(userId)
  return people.size
}

/**
 * Languages you practise besides your native ones: those of the Echo cards
 * you have reviewed at least once, and those of the posts you wrote.
 *
 * Read as a handful of index lookups, never as the person's cards or posts:
 * this runs on every open of Me and of the v3 shelf, and a heavy Echo user
 * holds thousands of cards.
 *
 * - The languages each side holds are a `distinct` over an index that leads
 *   with the person and then the language (`owner_lang_recent` on
 *   `echoCards`, `author_language` on `posts`), which MongoDB answers by
 *   skipping from one language to the next in the index, not by reading rows.
 * - Whether a card language has been *reviewed* is one bounded existence
 *   check per language (`limit: 1` on the same index), and only for the
 *   languages that would change the answer: not native, not already counted
 *   from a post.
 */
export async function countLanguagesPractised(
  db: Db,
  userId: string,
  nativeCodes: readonly string[],
): Promise<number> {
  const cards = db.collection<{ userId: string; lang: string }>(COLLECTIONS.echoCards)
  const [cardLangs, postLangs] = await Promise.all([
    cards.distinct('lang', { userId }),
    db
      .collection<{ authorId: string; language: string }>(COLLECTIONS.posts)
      .distinct('language', { authorId: userId }),
  ])
  const natives = new Set(nativeCodes.map((code) => code.toLowerCase()))
  const keep = (code: unknown): code is string =>
    typeof code === 'string' && code !== '' && !natives.has(code.toLowerCase())

  const practised = new Set(postLangs.filter(keep).map((code) => code.toLowerCase()))
  const unsure = cardLangs.filter((code) => keep(code) && !practised.has(code.toLowerCase()))
  const reviewed = await Promise.all(
    unsure.map((lang) =>
      cards.countDocuments({ userId, lang, 'srs.reps': { $gt: 0 } }, { limit: 1 }),
    ),
  )
  unsure.forEach((lang, i) => {
    if (reviewed[i]! > 0) practised.add(lang.toLowerCase())
  })
  return practised.size
}
