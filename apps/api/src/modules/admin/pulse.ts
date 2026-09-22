import { ONLINE_WINDOW_MS } from '@langx/shared'
import type { Db, Filter } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import type { SchedulerLogger } from '../tokens/poolScheduler'

/**
 * How many people are in the app right now, and the shape of the last hour.
 *
 * Separate from `stats.ts` because it answers a different question at a
 * different rate: that module is a minute-cached snapshot of everything, this
 * is one indexed count the panel asks for every few seconds. Putting the live
 * number behind that cache would make "live" mean "up to a minute old", and
 * dropping that cache to suit this one field would recompute the nine scans
 * behind it every poll.
 *
 * **The history has to be in the database, not in this process.** Production
 * is two machines and a blue-green deploy briefly makes it four (`ws/index.ts`
 * says why that matters for sockets); a ring buffer in module scope would give
 * each machine its own half of the picture, and a dashboard polling through a
 * load balancer would draw alternating samples from two of them as if they
 * were one series. So each instance writes into a shared minute bucket keyed
 * by its own timestamp, `$setOnInsert` makes the second writer a no-op, and
 * every reader sees the same hour however many machines wrote it.
 *
 * The count itself is cluster-wide for free: presence is `stats.lastActiveAt`
 * on a profile (`presence/touchPresence`), written by whichever machine holds
 * the socket and read from one place by everybody.
 */

/** One sample per minute. Finer than the five-minute window it measures would be noise. */
export const PULSE_BUCKET_MS = 60 * 1000

/** How many buckets the chart draws: an hour at a minute each. */
export const PULSE_POINTS = 60

/**
 * Long enough that a reader always has the full hour behind them, short enough
 * that the collection is a few dozen documents forever.
 */
export const PULSE_RETENTION_SECONDS = 2 * 60 * 60

/** How often an instance samples. One bucket, so every bucket gets a writer. */
export const PULSE_SAMPLE_INTERVAL_MS = PULSE_BUCKET_MS

/** One stored sample. `online` is null for a minute nobody recorded. */
export interface PulsePoint {
  at: string
  online: number | null
}

export interface AdminPulse {
  /** When the headline was counted — not when a bucket was written. */
  at: string
  /** People seen within `windowMs`, counted fresh on every read. */
  online: number
  /** The definition behind `online`, so the panel can say what it means. */
  windowMs: number
  bucketMs: number
  /** `PULSE_POINTS` slots, oldest first, evenly spaced by `bucketMs`. */
  history: PulsePoint[]
}

/** What one minute's row looks like. `_id` is the bucket, so two writers collide. */
interface PresenceSample {
  _id: string
  at: Date
  online: number
}

/** The start of the minute `at` falls in. */
function bucketOf(at: Date): Date {
  return new Date(Math.floor(at.getTime() / PULSE_BUCKET_MS) * PULSE_BUCKET_MS)
}

/**
 * Everyone whose presence was touched inside the window.
 *
 * Exactly the expression behind the green dot on a profile (`isOnline` in
 * `shared/discovery.ts`) and served by the `last_active` index, so the number
 * on the dashboard and the dot a member sees can never mean two things.
 *
 * Guests are counted, deliberately: this says who is *in the app*, and a
 * browsing session with no account behind it is still a person looking at it.
 * It is the same population `seenLastWeek` on the dashboard counts, only over
 * five minutes instead of seven days, which is what makes the two comparable.
 */
export async function countOnline(db: Db, now: Date = new Date()): Promise<number> {
  return db.collection<Profile>(COLLECTIONS.profiles).countDocuments(onlineFilter(now))
}

/** Shared by the count and the list behind it, so the two cannot disagree. */
function onlineFilter(now: Date): Filter<Profile> {
  return { 'stats.lastActiveAt': { $gte: new Date(now.getTime() - ONLINE_WINDOW_MS) } }
}

/** One row of the list behind the live count. */
export interface OnlineRow {
  userId: string
  handle: string
  displayName: string
  /** Guests are in the count, so they are in the list — and marked, since they have no name. */
  guest: boolean
  lastActiveAt: string
}

/**
 * Enough rows that the list is the whole count at any scale this panel is
 * read at, and a ceiling rather than a page: the population is whoever was
 * seen in the last five minutes, so there is no cursor to hold on to — the
 * second page would be a different set of people by the time it was asked for.
 */
export const ONLINE_LIST_LIMIT = 500

/**
 * Who the live count is counting, most recently seen first.
 *
 * The same filter as `countOnline`, served by the same `last_active` index —
 * the number on the card and the length of this list are the same question
 * asked twice, and a list that disagreed with the number above it would be
 * worse than no list.
 */
export async function listOnline(db: Db, now: Date = new Date()): Promise<OnlineRow[]> {
  const rows = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find(onlineFilter(now))
    .sort({ 'stats.lastActiveAt': -1 })
    .limit(ONLINE_LIST_LIMIT)
    .toArray()

  return rows.map((profile) => ({
    userId: profile._id,
    handle: profile.handle,
    displayName: profile.displayName,
    guest: profile.guest === true,
    lastActiveAt: profile.stats.lastActiveAt.toISOString(),
  }))
}

/**
 * Counts, and records the count under this minute.
 *
 * `$setOnInsert` rather than `$set`: on two machines both ticks land in the
 * same bucket, and first-writer-wins is what stops the second one rewriting a
 * minute that is already history. The two counts come from the same database a
 * few milliseconds apart, so there is nothing to choose between them.
 */
export async function recordPresenceSample(db: Db, now: Date = new Date()): Promise<number> {
  const online = await countOnline(db, now)
  const at = bucketOf(now)
  await db
    .collection<PresenceSample>(COLLECTIONS.presenceSamples)
    .updateOne({ _id: at.toISOString() }, { $setOnInsert: { at, online } }, { upsert: true })
  return online
}

/**
 * The live number and the hour behind it.
 *
 * A read, and only a read — the sampler below is what fills the collection.
 * A minute with no row comes back as `null` rather than as a zero: the two
 * would draw the same empty column, and "nobody was here" is a very different
 * claim from "nothing was recorded".
 */
export async function readAdminPulse(db: Db, now: Date = new Date()): Promise<AdminPulse> {
  const newest = bucketOf(now)
  const oldest = new Date(newest.getTime() - (PULSE_POINTS - 1) * PULSE_BUCKET_MS)

  const [online, rows] = await Promise.all([
    countOnline(db, now),
    db
      .collection<PresenceSample>(COLLECTIONS.presenceSamples)
      .find({ at: { $gte: oldest } })
      .sort({ at: 1 })
      .limit(PULSE_POINTS)
      .toArray(),
  ])

  const byBucket = new Map(rows.map((row) => [row.at.getTime(), row.online]))
  const history = Array.from({ length: PULSE_POINTS }, (_, i) => {
    const at = oldest.getTime() + i * PULSE_BUCKET_MS
    return { at: new Date(at).toISOString(), online: byBucket.get(at) ?? null }
  })

  return {
    at: now.toISOString(),
    online,
    windowMs: ONLINE_WINDOW_MS,
    bucketMs: PULSE_BUCKET_MS,
    history,
  }
}

/**
 * The minute tick that gives the chart a past.
 *
 * Deliberately not a `jobRuns`/`jobHealth` job: those exist so a scheduled
 * pass that stopped firing is visible, and they are scoped by a `periodKey`
 * that makes exactly one instance do the work. This is the opposite on both
 * counts — every instance should sample, and a missed minute is already
 * visible as a gap in the chart it feeds.
 */
export function startPresenceSampler(
  db: Db,
  logger: SchedulerLogger,
  { intervalMs = PULSE_SAMPLE_INTERVAL_MS }: { intervalMs?: number } = {},
): { stop: () => void } {
  let running = false

  const tick = async (): Promise<void> => {
    if (running) return
    running = true
    try {
      await recordPresenceSample(db)
    } catch (error) {
      // Noisy is wrong here: this runs every minute and feeds a chart. A
      // failed sample costs one column, so it is worth a line and nothing more.
      logger.warn({ err: error }, 'presence sample failed')
    } finally {
      running = false
    }
  }

  void tick()
  const timer = setInterval(() => void tick(), intervalMs)
  timer.unref?.()
  return {
    stop: () => {
      clearInterval(timer)
    },
  }
}
