import {
  ERROR_CODES,
  testimonialUnlocked,
  type ListTestimonialsQuery,
  type ReceivedTestimonialsPage,
  type TestimonialPage,
  type TestimonialPerson,
  type TestimonialView,
  type TestimonialViewerState,
  type ThreadTestimonialState,
  type WrittenTestimonialsPage,
} from '@langx/shared'
import { MongoServerError, ObjectId, type Db, type Filter } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { decodeDateIdCursor, encodeDateIdCursor } from '../../lib/dateIdCursor'
import { findConversationBetween, type Conversation } from '../chat/conversations'
import { blockedUserIds } from '../moderation/blocks'
import { isOfficialId } from '../official/accounts'
import { findProfileByHandleOrId, type Profile } from '../profiles/profiles'

export interface TestimonialDoc {
  _id: ObjectId
  /** Who wrote it. */
  authorId: string
  /** Whose profile it is on. */
  subjectId: string
  /** The thread that unlocked it, kept so a moderator can read the context. */
  conversationId: ObjectId
  body: string
  createdAt: Date
  editedAt?: Date
  /**
   * The profile's owner took it off their profile. Theirs to undo, and never
   * told to the author — see `listProfileTestimonials`.
   */
  ownerHiddenAt?: Date
  /**
   * A moderator took it down. Its own field rather than a second meaning of
   * `ownerHiddenAt`, because the owner must not be able to undo it and the
   * author must not be able to edit it back.
   */
  moderatorHiddenAt?: Date
}

type PersonProfile = Pick<Profile, '_id' | 'handle' | 'displayName' | 'avatarUrl'>

const PERSON_PROJECTION = { _id: 1, handle: 1, displayName: 1, avatarUrl: 1 } as const

function collection(db: Db) {
  return db.collection<TestimonialDoc>(COLLECTIONS.testimonials)
}

function toPerson(profile: PersonProfile): TestimonialPerson {
  return {
    _id: profile._id,
    handle: profile.handle,
    displayName: profile.displayName || profile.handle,
    avatarUrl: profile.avatarUrl ?? null,
  }
}

function toView(doc: TestimonialDoc, author: PersonProfile, viewerId: string): TestimonialView {
  return {
    _id: doc._id.toHexString(),
    author: toPerson(author),
    body: doc.body,
    createdAt: doc.createdAt.toISOString(),
    editedAt: doc.editedAt ? doc.editedAt.toISOString() : null,
    mine: doc.authorId === viewerId,
  }
}

/** Live profiles only: a pending purge has nothing left to show. */
async function livePeople(db: Db, ids: string[]): Promise<Map<string, PersonProfile>> {
  if (ids.length === 0) return new Map()
  const rows = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find({ _id: { $in: ids }, deletedAt: { $exists: false } })
    .project<PersonProfile>(PERSON_PROJECTION)
    .toArray()
  return new Map(rows.map((row) => [row._id, row]))
}

function cursorFilter(cursor: string | undefined): Filter<TestimonialDoc> {
  if (!cursor) return {}
  const { date, id } = decodeDateIdCursor(cursor)
  return { $or: [{ createdAt: { $lt: date } }, { createdAt: date, _id: { $lt: id } }] }
}

async function page(
  db: Db,
  filter: Filter<TestimonialDoc>,
  query: ListTestimonialsQuery,
): Promise<{ rows: TestimonialDoc[]; nextCursor: string | null }> {
  const found = await collection(db)
    .find({ ...filter, ...cursorFilter(query.cursor) })
    .sort({ createdAt: -1, _id: -1 })
    // One extra to know whether a next page exists without a second round trip.
    .limit(query.limit + 1)
    .toArray()
  const hasMore = found.length > query.limit
  const rows = hasMore ? found.slice(0, query.limit) : found
  const last = rows.at(-1)
  return {
    rows,
    nextCursor: hasMore && last ? encodeDateIdCursor(last.createdAt, last._id) : null,
  }
}

function isDuplicateKeyError(error: unknown, indexName: string): boolean {
  return (
    error instanceof MongoServerError && error.code === 11000 && error.message.includes(indexName)
  )
}

/**
 * Whether this thread lets its two people write about each other.
 *
 * Official accounts are shut out here rather than at each caller: `@langx`
 * welcomes everybody and would otherwise accumulate a wall of praise it never
 * earned, and a testimonial *from* it would read as the app vouching for
 * somebody.
 */
function threadUnlocked(conversation: Conversation, now: Date): boolean {
  if (conversation.participants.some(isOfficialId)) return false
  return testimonialUnlocked({
    participants: conversation.participants,
    messageCountBy: conversation.messageCountBy,
    firstMessageAt: conversation.firstMessageAt,
    now,
  })
}

/**
 * The chat's half of the feature, on a thread's first page. Cheap on purpose:
 * `unlocked` is read off the conversation already in hand, and `written` is
 * one lookup on `author_subject_unique`.
 *
 * `written` counts a row a moderator removed too — the author cannot write a
 * second one, so offering the composer would only lead to a refusal.
 */
export async function threadTestimonialState(
  db: Db,
  conversation: Conversation,
  viewerId: string,
): Promise<ThreadTestimonialState> {
  const otherId = conversation.participants.find((id) => id !== viewerId)
  if (!otherId) return { unlocked: false, written: false }
  const existing = await collection(db).findOne(
    { authorId: viewerId, subjectId: otherId },
    { projection: { _id: 1 } },
  )
  return { unlocked: threadUnlocked(conversation, new Date()), written: existing !== null }
}

/**
 * The same answer for a thread that did not exist a moment ago, without the
 * lookup: a testimonial needs an unlocked thread, and a thread whose first
 * message was just written cannot have had one. Synchronous so
 * `openingPage` stays pure — it has to match the page a fetch would return.
 */
export function openingThreadTestimonialState(conversation: Conversation): ThreadTestimonialState {
  return { unlocked: threadUnlocked(conversation, new Date()), written: false }
}

export interface UpsertTestimonialResult {
  testimonial: TestimonialView
  /** False when this was an edit — the route only notifies on a new one. */
  created: boolean
}

/**
 * Writes the author's testimonial about the subject, or edits it.
 *
 * Every refusal lives here rather than in the route, so no other transport
 * can reach the collection around them:
 *
 * - yourself: `VALIDATION_FAILED`;
 * - a subject who is gone or blocked in either direction: `NOT_FOUND`, the
 *   same answer `followUser` gives — a blocked account is absent, and a 403
 *   would confirm it exists;
 * - an official account on either end, no thread, or a thread that has not
 *   unlocked: `TESTIMONIAL_LOCKED`, one code so the client never learns how
 *   close the pair is;
 * - a row a moderator removed: `TESTIMONIAL_REMOVED`.
 *
 * Update first, then insert: the common repeat is an edit, and the unique
 * index decides the race — two submissions at once become one row and an
 * edit, never two rows. An edit leaves `ownerHiddenAt` alone on purpose:
 * rewording a testimonial is not a way back onto a profile that hid it.
 */
export async function upsertTestimonial(
  db: Db,
  authorId: string,
  subjectId: string,
  body: string,
  now: Date = new Date(),
): Promise<UpsertTestimonialResult> {
  if (authorId === subjectId) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'You cannot write about yourself')
  }

  const [people, hidden, conversation] = await Promise.all([
    livePeople(db, [authorId, subjectId]),
    blockedUserIds(db, authorId),
    findConversationBetween(db, authorId, subjectId),
  ])
  const author = people.get(authorId)
  if (!author || !people.has(subjectId) || hidden.includes(subjectId)) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 'Profile not found')
  }
  if (!conversation || !threadUnlocked(conversation, now)) {
    throw new ApiError(ERROR_CODES.TESTIMONIAL_LOCKED, 'Not unlocked for this pair yet')
  }

  const testimonials = collection(db)
  const edit = () =>
    testimonials.findOneAndUpdate(
      { authorId, subjectId, moderatorHiddenAt: { $exists: false } },
      { $set: { body, editedAt: now } },
      { returnDocument: 'after' },
    )

  const edited = await edit()
  if (edited) return { testimonial: toView(edited, author, authorId), created: false }

  const doc: TestimonialDoc = {
    _id: new ObjectId(),
    authorId,
    subjectId,
    conversationId: conversation._id,
    body,
    createdAt: now,
  }
  try {
    await testimonials.insertOne(doc)
    return { testimonial: toView(doc, author, authorId), created: true }
  } catch (error) {
    if (!isDuplicateKeyError(error, 'author_subject_unique')) throw error
  }

  // The row exists and the edit above missed it: either a moderator removed
  // it, or a concurrent first submission landed between the two writes — in
  // which case this one is the edit.
  const raced = await edit()
  if (raced) return { testimonial: toView(raced, author, authorId), created: false }
  throw new ApiError(ERROR_CODES.TESTIMONIAL_REMOVED, 'This testimonial was removed')
}

/**
 * The author takes theirs back. Idempotent.
 *
 * A row a moderator removed is left where it is: it is the evidence behind
 * that decision, and deleting it would also free the author to write the same
 * words again as a "new" testimonial.
 */
export async function deleteTestimonial(
  db: Db,
  authorId: string,
  subjectId: string,
): Promise<void> {
  await collection(db).deleteOne({
    authorId,
    subjectId,
    moderatorHiddenAt: { $exists: false },
  })
}

/**
 * `GET /profiles/:handle/testimonials`, as the viewer is allowed to see it.
 *
 * Left out, for everybody: a moderator's removals; anyone blocked by the
 * viewer or by the subject, in either direction (nothing is deleted on a
 * block — it is filtered here); and authors whose account is pending purge.
 * Left out for everybody *but its author*: a row the owner hid. The author
 * sees their own exactly as before, with no mark on it, because telling them
 * would turn "hide" into a confrontation the owner chose not to have.
 *
 * `total` counts with the very filter the pages walk, so the number and the
 * list can never disagree about a row. There is no public count of hidden
 * rows at all.
 */
export async function listProfileTestimonials(
  db: Db,
  viewerId: string,
  handle: string,
  query: ListTestimonialsQuery,
): Promise<TestimonialPage> {
  const subject = await findProfileByHandleOrId(db, handle)
  const viewerHidden = await blockedUserIds(db, viewerId)
  if (!subject || viewerHidden.includes(subject._id)) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 'Profile not found')
  }

  const testimonials = collection(db)
  const [subjectHidden, authorIds, ownRow, conversation] = await Promise.all([
    blockedUserIds(db, subject._id),
    testimonials.distinct('authorId', { subjectId: subject._id }),
    viewerId === subject._id
      ? Promise.resolve(null)
      : testimonials.findOne({ authorId: viewerId, subjectId: subject._id }),
    viewerId === subject._id
      ? Promise.resolve(null)
      : findConversationBetween(db, viewerId, subject._id),
  ])

  /*
   * Authors are narrowed to a positive list of live, unblocked people rather
   * than `$nin` of the excluded ones, because "deleted" is a fact about the
   * author's profile that the testimonial row does not carry. A profile's
   * testimonials are bounded by the conversations it has had, so this list
   * stays small.
   */
  const excluded = new Set([...viewerHidden, ...subjectHidden])
  const authors = await livePeople(
    db,
    authorIds.filter((id) => !excluded.has(id)),
  )

  const filter: Filter<TestimonialDoc> = {
    subjectId: subject._id,
    authorId: { $in: [...authors.keys()] },
    moderatorHiddenAt: { $exists: false },
    $and: [{ $or: [{ ownerHiddenAt: { $exists: false } }, { authorId: viewerId }] }],
  }

  const [{ rows, nextCursor }, total] = await Promise.all([
    page(db, filter, query),
    testimonials.countDocuments(filter),
  ])

  const items = rows.flatMap((row) => {
    const author = authors.get(row.authorId)
    return author ? [toView(row, author, viewerId)] : []
  })

  const viewerProfile = authors.get(viewerId)
  const mine =
    ownRow && !ownRow.moderatorHiddenAt && viewerProfile
      ? toView(ownRow, viewerProfile, viewerId)
      : null

  let viewer: TestimonialViewerState
  if (viewerId === subject._id) viewer = 'self'
  else if (ownRow) viewer = 'written'
  else if (conversation && threadUnlocked(conversation, new Date())) viewer = 'can_write'
  else viewer = 'locked'

  return { items, total, nextCursor, viewer, mine }
}

/**
 * The owner's own list: everything on their profile, hidden rows included and
 * marked, so they can be un-hidden. A moderator's removals are not here —
 * there is nothing the owner can do about them.
 */
export async function listReceivedTestimonials(
  db: Db,
  userId: string,
  query: ListTestimonialsQuery,
): Promise<ReceivedTestimonialsPage> {
  const hidden = await blockedUserIds(db, userId)
  const filter: Filter<TestimonialDoc> = {
    subjectId: userId,
    moderatorHiddenAt: { $exists: false },
    ...(hidden.length > 0 ? { authorId: { $nin: hidden } } : {}),
  }
  const { rows, nextCursor } = await page(db, filter, query)
  const authors = await livePeople(
    db,
    rows.map((row) => row.authorId),
  )
  // A row whose author is pending purge is dropped rather than rendered, so a
  // page can come back short — the accepted shape in the follows list.
  const items = rows.flatMap((row) => {
    const author = authors.get(row.authorId)
    return author
      ? [{ ...toView(row, author, userId), hidden: row.ownerHiddenAt !== undefined }]
      : []
  })
  return { items, nextCursor }
}

/**
 * The author's own list. Rows a moderator removed are shown and marked —
 * the one place that decision is visible to the author. Whether the owner
 * hid one is not: see `listProfileTestimonials`.
 */
export async function listWrittenTestimonials(
  db: Db,
  userId: string,
  query: ListTestimonialsQuery,
): Promise<WrittenTestimonialsPage> {
  const hidden = await blockedUserIds(db, userId)
  const filter: Filter<TestimonialDoc> = {
    authorId: userId,
    ...(hidden.length > 0 ? { subjectId: { $nin: hidden } } : {}),
  }
  const { rows, nextCursor } = await page(db, filter, query)
  const subjects = await livePeople(
    db,
    rows.map((row) => row.subjectId),
  )
  const items = rows.flatMap((row) => {
    const subject = subjects.get(row.subjectId)
    if (!subject) return []
    return [
      {
        _id: row._id.toHexString(),
        subject: toPerson(subject),
        body: row.body,
        createdAt: row.createdAt.toISOString(),
        editedAt: row.editedAt ? row.editedAt.toISOString() : null,
        removed: row.moderatorHiddenAt !== undefined,
      },
    ]
  })
  return { items, nextCursor }
}

/**
 * The owner hides or restores a testimonial on their own profile.
 *
 * `NOT_FOUND` for anything that is not on the caller's profile — somebody
 * else's, a malformed id, one that does not exist — so the endpoint cannot be
 * used to learn which ids exist. A moderator's removal is not the owner's to
 * undo, so it answers the same way.
 */
export async function setTestimonialOwnerHidden(
  db: Db,
  userId: string,
  testimonialId: string,
  hidden: boolean,
): Promise<void> {
  if (!ObjectId.isValid(testimonialId)) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 'Testimonial not found')
  }
  const result = await collection(db).updateOne(
    {
      _id: new ObjectId(testimonialId),
      subjectId: userId,
      moderatorHiddenAt: { $exists: false },
    },
    hidden ? { $set: { ownerHiddenAt: new Date() } } : { $unset: { ownerHiddenAt: '' } },
  )
  if (result.matchedCount === 0) {
    throw new ApiError(ERROR_CODES.NOT_FOUND, 'Testimonial not found')
  }
}

/**
 * For the moderation side, which checks that a reported testimonial is the
 * reported person's own before it lets a report name it. Unfiltered: an
 * already-removed one can still be looked at.
 */
export async function findTestimonialById(db: Db, id: ObjectId): Promise<TestimonialDoc | null> {
  return collection(db).findOne({ _id: id })
}

/**
 * A moderator removes or restores one. Returns whether anything changed, so a
 * decision applied twice can say it was already done.
 */
export async function setTestimonialModeratorHidden(
  db: Db,
  testimonialId: ObjectId,
  hidden: boolean,
): Promise<boolean> {
  const result = await collection(db).updateOne(
    hidden
      ? { _id: testimonialId, moderatorHiddenAt: { $exists: false } }
      : { _id: testimonialId, moderatorHiddenAt: { $exists: true } },
    hidden ? { $set: { moderatorHiddenAt: new Date() } } : { $unset: { moderatorHiddenAt: '' } },
  )
  return result.modifiedCount > 0
}

/**
 * Account deletion: everything the person wrote and everything written about
 * them. Both, because a testimonial is about a pair — one about somebody who
 * no longer exists vouches for nothing, and one by them would be a deleted
 * account's words still on show.
 */
export async function purgeTestimonialsOf(db: Db, userId: string): Promise<number> {
  const result = await collection(db).deleteMany({
    $or: [{ authorId: userId }, { subjectId: userId }],
  })
  return result.deletedCount
}

export interface ExportedTestimonial {
  id: string
  authorId: string
  subjectId: string
  body: string
  createdAt: string
  editedAt: string | null
  hiddenByOwner: boolean
  removedByModerator: boolean
}

/**
 * The data export's rows, plain JSON. Every row the person is on either end
 * of, hidden or removed ones included — the export is what we hold, not what
 * the profile shows.
 */
export async function testimonialsForExport(
  db: Db,
  userId: string,
): Promise<{ written: ExportedTestimonial[]; received: ExportedTestimonial[] }> {
  const rows = await collection(db)
    .find({ $or: [{ authorId: userId }, { subjectId: userId }] })
    .sort({ createdAt: 1, _id: 1 })
    .toArray()
  const plain = (row: TestimonialDoc): ExportedTestimonial => ({
    id: row._id.toHexString(),
    authorId: row.authorId,
    subjectId: row.subjectId,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    editedAt: row.editedAt ? row.editedAt.toISOString() : null,
    hiddenByOwner: row.ownerHiddenAt !== undefined,
    removedByModerator: row.moderatorHiddenAt !== undefined,
  })
  return {
    written: rows.filter((row) => row.authorId === userId).map(plain),
    received: rows.filter((row) => row.subjectId === userId).map(plain),
  }
}
