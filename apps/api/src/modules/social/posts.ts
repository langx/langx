import {
  SOCIAL_AUTOPOST_RULES,
  type SocialPlatform,
  type SocialPostAction,
  type SocialPostContent,
  type SocialPostDto,
  type SocialPostStatus,
} from '@langx/shared'
import { MongoServerError, ObjectId, type Db, type Filter } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'

/**
 * Venus's day videos on our own accounts, one row per calendar slot per
 * platform. Every read and write of `socialPosts` is here.
 *
 * Three things keep a video from going out twice, and each covers what the
 * others cannot. `calendar_slot_platform_unique` allows one row per slot and
 * platform. The claim from `approved` to `publishing` hands a row to one
 * poster. And a claim that dies — the process restarted mid-post — fails
 * rather than going back to `approved`, because the platform may already
 * have posted it, and only a person looking at the account can tell.
 */

/** The English post a language swap falls back to (`enAlternate`), for this row's platform. */
export interface SocialPostAlternate {
  lang: string
  videoUrl: string
  coverUrl: string
  scheduledAt: Date
  content: SocialPostContent
  firstComment: string | null
}

/** What a calendar decides about a row — everything an import may write. */
export interface SocialPostSlot {
  calendarVersion: number
  dayOffset: number
  platform: SocialPlatform
  videoDay: number
  lang: string
  videoUrl: string
  coverUrl: string
  /** The slot's time in UTC. Never moved by a retry; `dueAt` is. */
  scheduledAt: Date
  content: SocialPostContent
  /** Instagram's only: the other platforms have nowhere this app may put one. */
  firstComment: string | null
  /** Set on a language swap a native speaker must read first. A bulk approve passes it by. */
  nativeCheck: string | null
  alternate: SocialPostAlternate | null
}

export interface SocialPost extends SocialPostSlot {
  _id: ObjectId
  status: SocialPostStatus
  /** When the scheduler may next take the row: the slot's time, then a retry's. */
  dueAt: Date
  /** Claims taken so far, the one in progress included. */
  attempts: number
  /** When the current claim was taken, for spotting one that never finished. */
  claimedAt?: Date
  lastError: string | null
  note: string | null
  platformPostId: string | null
  platformUrl: string | null
  publishedAt: Date | null
  approvedAt: Date | null
  approvedBy: string | null
  createdAt: Date
  updatedAt: Date
}

/** Not out yet, and still the operator's to change. */
const UPCOMING: SocialPostStatus[] = ['draft', 'approved', 'publishing']
const SETTLED: SocialPostStatus[] = ['published', 'failed', 'skipped']

/** How many rows of each list the panel is sent: a fortnight of four platforms. */
const LIST_LIMIT = 60

function collection(db: Db) {
  return db.collection<SocialPost>(COLLECTIONS.socialPosts)
}

function slotKey(slot: Pick<SocialPostSlot, 'calendarVersion' | 'dayOffset' | 'platform'>) {
  return {
    calendarVersion: slot.calendarVersion,
    dayOffset: slot.dayOffset,
    platform: slot.platform,
  }
}

export function toSocialPostDto(row: SocialPost): SocialPostDto {
  return {
    _id: row._id.toHexString(),
    calendarVersion: row.calendarVersion,
    dayOffset: row.dayOffset,
    videoDay: row.videoDay,
    platform: row.platform,
    lang: row.lang,
    videoUrl: row.videoUrl,
    coverUrl: row.coverUrl,
    scheduledAt: row.scheduledAt.toISOString(),
    status: row.status,
    content: row.content,
    firstComment: row.firstComment,
    nativeCheck: row.nativeCheck,
    attempts: row.attempts,
    lastError: row.lastError,
    note: row.note,
    platformPostId: row.platformPostId,
    platformUrl: row.platformUrl,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
  }
}

/** The fields an import compares to decide whether an approved row still says what was approved. */
function sameSlot(row: SocialPost, slot: SocialPostSlot): boolean {
  const pick = (value: SocialPostSlot) =>
    JSON.stringify([
      value.videoDay,
      value.lang,
      value.videoUrl,
      value.coverUrl,
      value.scheduledAt.toISOString(),
      value.content,
      value.firstComment,
      value.nativeCheck,
      value.alternate && {
        ...value.alternate,
        scheduledAt: value.alternate.scheduledAt.toISOString(),
      },
    ])
  return pick(row) === pick(slot)
}

export interface SocialImportResult {
  inserted: number
  /** Drafts rewritten to match the file. */
  updated: number
  /** Approved rows the file changed, put back to draft: an approval covers what was read. */
  unapproved: number
  /** Rows left as they were — unchanged, or already out of the operator's hands. */
  kept: number
}

/**
 * Writes a calendar's rows as drafts, and is safe to run again.
 *
 * A draft takes whatever the file now says. An approved row the file has
 * changed goes back to draft, because the approval was of the old words or
 * the old time; one the file has not changed stays approved. Anything past
 * that — claimed, out, failed, skipped — is history and is left alone.
 */
export async function importSocialSlots(
  db: Db,
  slots: SocialPostSlot[],
  now: Date = new Date(),
): Promise<SocialImportResult> {
  const result: SocialImportResult = { inserted: 0, updated: 0, unapproved: 0, kept: 0 }
  for (const slot of slots) {
    const existing = await collection(db).findOne(slotKey(slot))
    if (!existing) {
      try {
        await collection(db).insertOne({
          ...slot,
          _id: new ObjectId(),
          status: 'draft',
          dueAt: slot.scheduledAt,
          attempts: 0,
          lastError: null,
          note: null,
          platformPostId: null,
          platformUrl: null,
          publishedAt: null,
          approvedAt: null,
          approvedBy: null,
          createdAt: now,
          updatedAt: now,
        })
        result.inserted++
      } catch (caught) {
        // Another import wrote it first; the unique index is doing its job.
        if (!(caught instanceof MongoServerError) || caught.code !== 11000) throw caught
        result.kept++
      }
      continue
    }

    if (existing.status === 'draft') {
      const written = await collection(db).updateOne(
        { _id: existing._id, status: 'draft' },
        { $set: { ...slot, dueAt: slot.scheduledAt, updatedAt: now } },
      )
      if (written.modifiedCount === 1) result.updated++
      else result.kept++
      continue
    }

    if (existing.status === 'approved' && !sameSlot(existing, slot)) {
      const written = await collection(db).updateOne(
        { _id: existing._id, status: 'approved' },
        {
          $set: {
            ...slot,
            status: 'draft',
            dueAt: slot.scheduledAt,
            approvedAt: null,
            approvedBy: null,
            updatedAt: now,
          },
        },
      )
      if (written.modifiedCount === 1) result.unapproved++
      else result.kept++
      continue
    }

    result.kept++
  }
  return result
}

export interface SocialSlotFilter {
  calendarVersion: number
  dayOffset?: number
  platform?: SocialPlatform
}

function slotFilter(filter: SocialSlotFilter): Filter<SocialPost> {
  return {
    calendarVersion: filter.calendarVersion,
    ...(filter.dayOffset !== undefined ? { dayOffset: filter.dayOffset } : {}),
    ...(filter.platform ? { platform: filter.platform } : {}),
  }
}

export interface SocialApproveResult {
  approved: number
  /** Days a bulk approve passed by because a native speaker has not read them yet. */
  heldForNativeCheck: number[]
}

/**
 * Moves drafts to approved — the whole calendar, one day, or one platform.
 *
 * A bulk approve leaves language swaps that wait for a native check where
 * they are: the calendar says those must not post until somebody who speaks
 * the language has read them, and approving a hundred days at once is not
 * that reading. Naming the day approves it, because naming it is.
 */
export async function approveSocialPosts(
  db: Db,
  filter: SocialSlotFilter,
  approvedBy: string,
  now: Date = new Date(),
): Promise<SocialApproveResult> {
  const base: Filter<SocialPost> = { ...slotFilter(filter), status: 'draft' }
  const naming = filter.dayOffset !== undefined
  const held = naming
    ? []
    : await collection(db).distinct('dayOffset', { ...base, nativeCheck: { $ne: null } })
  const written = await collection(db).updateMany(naming ? base : { ...base, nativeCheck: null }, [
    {
      $set: {
        status: 'approved',
        dueAt: '$scheduledAt',
        approvedAt: now,
        approvedBy,
        updatedAt: now,
      },
    },
  ])
  return { approved: written.modifiedCount, heldForNativeCheck: held.sort((a, b) => a - b) }
}

/**
 * Swaps a language day's drafts for their English alternate — what the
 * calendar offers when the swap is declined. The swap is then gone from the
 * row; importing the file again brings it back.
 */
export async function useSocialAlternate(
  db: Db,
  filter: SocialSlotFilter,
  now: Date = new Date(),
): Promise<number> {
  const rows = await collection(db)
    .find({ ...slotFilter(filter), status: 'draft', alternate: { $ne: null } })
    .toArray()
  let swapped = 0
  for (const row of rows) {
    const alternate = row.alternate
    if (!alternate) continue
    const written = await collection(db).updateOne(
      { _id: row._id, status: 'draft' },
      {
        $set: {
          lang: alternate.lang,
          videoUrl: alternate.videoUrl,
          coverUrl: alternate.coverUrl,
          scheduledAt: alternate.scheduledAt,
          dueAt: alternate.scheduledAt,
          content: alternate.content,
          firstComment: alternate.firstComment,
          nativeCheck: null,
          alternate: null,
          updatedAt: now,
        },
      },
    )
    swapped += written.modifiedCount
  }
  return swapped
}

/** Skips everything matching that has not gone out — the script's `skip`. */
export async function skipSocialPosts(
  db: Db,
  filter: SocialSlotFilter,
  now: Date = new Date(),
): Promise<number> {
  const written = await collection(db).updateMany(
    { ...slotFilter(filter), status: { $in: ['draft', 'approved', 'failed'] } },
    { $set: { status: 'skipped', updatedAt: now } },
  )
  return written.modifiedCount
}

/**
 * One row, from the panel. `null` when the row does not exist or is not in a
 * state the action applies to — a row claimed a moment ago, say.
 *
 * `retry` sends a failed row again now, with its attempts reset: whoever
 * presses it has looked, which is what a failure that may have posted asks
 * for. A retry is not held to the lateness rule from the slot's time, only
 * from the press — it is a decision to post it now.
 */
export async function applySocialPostAction(
  db: Db,
  id: string,
  action: SocialPostAction,
  operatorId: string,
  now: Date = new Date(),
): Promise<SocialPost | null> {
  if (!ObjectId.isValid(id)) return null
  const _id = new ObjectId(id)
  switch (action) {
    case 'approve':
      return collection(db).findOneAndUpdate(
        { _id, status: { $in: ['draft', 'skipped'] } },
        [
          {
            $set: {
              status: 'approved',
              dueAt: '$scheduledAt',
              approvedAt: now,
              approvedBy: operatorId,
              updatedAt: now,
            },
          },
        ],
        { returnDocument: 'after' },
      )
    case 'skip':
      return collection(db).findOneAndUpdate(
        { _id, status: { $in: ['draft', 'approved', 'failed'] } },
        { $set: { status: 'skipped', updatedAt: now } },
        { returnDocument: 'after' },
      )
    case 'retry':
      return collection(db).findOneAndUpdate(
        { _id, status: 'failed' },
        {
          $set: {
            status: 'approved',
            dueAt: now,
            attempts: 0,
            lastError: null,
            approvedAt: now,
            approvedBy: operatorId,
            updatedAt: now,
          },
        },
        { returnDocument: 'after' },
      )
  }
}

/** The panel's two lists, optionally for one platform. */
export async function listSocialPosts(
  db: Db,
  platform?: SocialPlatform,
): Promise<{ upcoming: SocialPost[]; recent: SocialPost[] }> {
  const which = platform ? { platform } : {}
  const [upcoming, recent] = await Promise.all([
    collection(db)
      .find({ ...which, status: { $in: UPCOMING } })
      .sort({ scheduledAt: 1, platform: 1 })
      .limit(LIST_LIMIT)
      .toArray(),
    collection(db)
      .find({ ...which, status: { $in: SETTLED } })
      .sort({ updatedAt: -1 })
      .limit(LIST_LIMIT)
      .toArray(),
  ])
  return { upcoming, recent }
}

/** The newest calendar imported, which the script's commands act on unless told otherwise. */
export async function latestSocialCalendarVersion(db: Db): Promise<number | null> {
  const row = await collection(db).findOne(
    {},
    { sort: { calendarVersion: -1 }, projection: { calendarVersion: 1 } },
  )
  return row?.calendarVersion ?? null
}

/**
 * The rows of the next `slots` calendar days that have not gone out, soonest
 * first — what the dry run prints.
 */
export async function nextSocialPosts(
  db: Db,
  slots: number,
  now: Date = new Date(),
): Promise<SocialPost[]> {
  const rows = await collection(db)
    .find({ status: { $in: ['draft', 'approved'] }, scheduledAt: { $gte: now } })
    .sort({ scheduledAt: 1, platform: 1 })
    .toArray()
  const days = [...new Set(rows.map((row) => `${row.calendarVersion}:${row.dayOffset}`))].slice(
    0,
    slots,
  )
  return rows.filter((row) => days.includes(`${row.calendarVersion}:${row.dayOffset}`))
}

/**
 * Takes the next due row, atomically. Two passes — two machines, or a slow
 * tick overlapping the next — can ask at once; `findOneAndUpdate` from
 * `approved` hands any one row to exactly one of them.
 */
export async function claimDueSocialPost(db: Db, now: Date): Promise<SocialPost | null> {
  return collection(db).findOneAndUpdate(
    { status: 'approved', dueAt: { $lte: now } },
    { $set: { status: 'publishing', claimedAt: now, updatedAt: now }, $inc: { attempts: 1 } },
    { sort: { dueAt: 1 }, returnDocument: 'after' },
  )
}

export async function markSocialPublished(
  db: Db,
  id: ObjectId,
  result: { id: string; url: string | null; note?: string | null },
  now: Date,
): Promise<void> {
  await collection(db).updateOne(
    { _id: id, status: 'publishing' },
    {
      $set: {
        status: 'published',
        platformPostId: result.id,
        platformUrl: result.url,
        note: result.note ?? null,
        lastError: null,
        publishedAt: now,
        updatedAt: now,
      },
      $unset: { claimedAt: '' },
    },
  )
}

export async function markSocialFailed(
  db: Db,
  id: ObjectId,
  error: string,
  now: Date,
): Promise<void> {
  await collection(db).updateOne(
    { _id: id, status: 'publishing' },
    { $set: { status: 'failed', lastError: error, updatedAt: now }, $unset: { claimedAt: '' } },
  )
}

/** Puts a row that certainly posted nothing back in line, for `dueAt`. */
export async function deferSocialPost(
  db: Db,
  id: ObjectId,
  error: string,
  dueAt: Date,
  now: Date,
): Promise<void> {
  await collection(db).updateOne(
    { _id: id, status: 'publishing' },
    {
      $set: { status: 'approved', lastError: error, dueAt, updatedAt: now },
      $unset: { claimedAt: '' },
    },
  )
}

/**
 * Fails claims that never finished. Not retried, unlike a stuck scheduled
 * message: there the retry finds the message the first attempt wrote, here
 * there is nothing of ours to find — the post, if there is one, is on the
 * platform.
 */
export async function failStaleSocialClaims(db: Db, now: Date): Promise<number> {
  const stale = new Date(now.getTime() - SOCIAL_AUTOPOST_RULES.staleClaimMinutes * 60 * 1000)
  const written = await collection(db).updateMany(
    { status: 'publishing', claimedAt: { $lt: stale } },
    {
      $set: {
        status: 'failed',
        lastError:
          'Interrupted while publishing. It may have posted: check the account before retrying.',
        updatedAt: now,
      },
      $unset: { claimedAt: '' },
    },
  )
  return written.modifiedCount
}
