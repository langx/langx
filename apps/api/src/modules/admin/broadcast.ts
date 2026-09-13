import type { BroadcastStatus, Locale } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { notSuspended } from '../moderation/suspension'
import type { Profile } from '../profiles/profiles'

/**
 * One message from `@langx` to everybody, as a queued job the API works
 * through rather than a loop on somebody's laptop.
 *
 * `scripts/send-announcement.ts` did this well enough to keep its doctrine
 * whole — the idempotency, the per-locale bodies, the push as a knock rather
 * than the message — and badly in exactly two ways: the machine had to stay
 * awake, and there was no pacing at all. This is the same send, moved into the
 * scheduler.
 *
 * **No claim collection**, unlike `campaignQueue`. That one needs
 * `emailCampaigns` because an SMTP send leaves no row we own, so there is
 * nothing to ask afterwards whether a person was already written to. A chat
 * message *is* the row: `messages.sender_client_id_unique` on
 * `{senderId, clientId}` refuses the second write for a recipient and lets
 * every other one through. The cursor below paces the work; that index is what
 * makes it exactly once.
 */
export interface BroadcastJob {
  /** The slug. Being the primary key is what stops the same one running twice. */
  _id: string
  /** One body per locale; `en` is required and is the fallback. */
  bodies: Record<string, string>
  pushTitle: string
  status: BroadcastStatus
  createdAt: Date
  createdBy: string
  startedAt?: Date
  finishedAt?: Date
  /** The audience counted at create — a number to watch progress against. */
  total: number
  sent: number
  failed: number
  /**
   * The highest profile `_id` delivered to. Paging by primary key needs no
   * index and resumes after a crash; the batch that was in flight is simply
   * retried, and the clientId index refuses its duplicates.
   */
  cursorUserId?: string
}

/**
 * Who a broadcast goes to.
 *
 * The script's filter plus `notSuspended()`, which it did not have. Pushing an
 * announcement at somebody we suspended last week is the wrong call, and
 * `requireAuth` would refuse them the app it invited them into.
 */
export function broadcastAudience(now: Date = new Date()) {
  return {
    deletedAt: { $exists: false },
    guest: { $exists: false },
    official: { $exists: false },
    ...notSuspended(now),
  }
}

export function broadcasts(db: Db) {
  return db.collection<BroadcastJob>(COLLECTIONS.broadcastQueue)
}

export async function countBroadcastAudience(db: Db, now: Date = new Date()): Promise<number> {
  return db.collection<Profile>(COLLECTIONS.profiles).countDocuments(broadcastAudience(now))
}

export async function createBroadcast(
  db: Db,
  input: { id: string; bodies: Record<string, string>; pushTitle: string; createdBy: string },
  now: Date = new Date(),
): Promise<BroadcastJob> {
  const job: BroadcastJob = {
    _id: input.id,
    bodies: input.bodies,
    pushTitle: input.pushTitle,
    // A draft sends nothing. Starting it is a second, separate request — which
    // is the only reason a back button or a double tap cannot broadcast.
    status: 'draft',
    createdAt: now,
    createdBy: input.createdBy,
    total: await countBroadcastAudience(db, now),
    sent: 0,
    failed: 0,
  }
  await broadcasts(db).insertOne(job)
  return job
}

export async function listBroadcasts(db: Db, limit = 20): Promise<BroadcastJob[]> {
  return broadcasts(db).find({}).sort({ createdAt: -1 }).limit(limit).toArray()
}

export async function getBroadcast(db: Db, id: string): Promise<BroadcastJob | null> {
  return broadcasts(db).findOne({ _id: id })
}

/**
 * The state machine, as a table rather than a pile of conditionals.
 *
 * `done` is terminal and only the queue writes it. Everything else is the
 * operator: arm a draft, stop a send, let it go again.
 */
const ALLOWED: Record<string, BroadcastStatus[]> = {
  draft: ['queued'],
  queued: ['paused'],
  sending: ['paused'],
  paused: ['queued'],
}

export async function setBroadcastStatus(
  db: Db,
  id: string,
  next: BroadcastStatus,
): Promise<BroadcastJob | null> {
  const job = await getBroadcast(db, id)
  if (!job) return null
  if (!ALLOWED[job.status]?.includes(next)) return null
  return broadcasts(db).findOneAndUpdate(
    { _id: id, status: job.status },
    { $set: { status: next } },
    { returnDocument: 'after' },
  )
}

/** Only while it is a draft: once it has been armed there may be messages out. */
export async function deleteBroadcast(db: Db, id: string): Promise<boolean> {
  const { deletedCount } = await broadcasts(db).deleteOne({ _id: id, status: 'draft' })
  return deletedCount > 0
}

/** The body for one reader, in their own language, falling back to English. */
export function bodyFor(job: BroadcastJob, locale: Locale): string {
  return job.bodies[locale] ?? job.bodies.en ?? ''
}
