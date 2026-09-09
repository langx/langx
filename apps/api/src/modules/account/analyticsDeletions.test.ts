import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import type { PersonDeleter } from '../analytics/personDeleter'
import {
  type AnalyticsDeletion,
  drainAnalyticsDeletions,
  recordAnalyticsDeletion,
} from './analyticsDeletions'

/**
 * The queue exists because the purge deletes the row it is driven by, so a
 * PostHog call that fails has nothing left to be retried from. Everything
 * below is about that: what survives a failure, and what does not survive a
 * success.
 */
describe('the analytics deletion queue', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle

  /** Records the ids it was given, and fails on command. */
  function fakeDeleter(): PersonDeleter & { calls: string[][]; failWith: string | null } {
    const state = {
      calls: [] as string[][],
      failWith: null as string | null,
      deletePersons(distinctIds: readonly string[]): Promise<void> {
        state.calls.push([...distinctIds])
        return state.failWith ? Promise.reject(new Error(state.failWith)) : Promise.resolve()
      },
    }
    return state
  }

  function rows(): Promise<AnalyticsDeletion[]> {
    return handle.db
      .collection<AnalyticsDeletion>(COLLECTIONS.analyticsDeletions)
      .find({})
      .sort({ createdAt: 1 })
      .toArray()
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_analytics_deletion_test')
    await ensureIndexes(handle.db)
  }, 120_000)

  afterAll(async () => {
    await handle?.close()
    await replSet?.stop()
  })

  beforeEach(async () => {
    await handle.db.collection(COLLECTIONS.analyticsDeletions).deleteMany({})
  })

  it('records one row per account, and only one however often it is asked', async () => {
    const first = new Date('2026-09-01T00:00:00.000Z')
    const later = new Date('2026-09-02T00:00:00.000Z')
    await recordAnalyticsDeletion(handle.db, 'aaaaaaaaaaaaaaaaaaaaaaaa', first)
    await recordAnalyticsDeletion(handle.db, 'aaaaaaaaaaaaaaaaaaaaaaaa', later)

    const [row, ...rest] = await rows()
    expect(rest).toEqual([])
    // The first sighting is the one that counts: the queue drains oldest
    // first, and a re-record must not send an account to the back of it.
    expect(row?.createdAt).toEqual(first)
    expect(row?.attempts).toBe(0)
  })

  it('sends the distinct ids and clears what PostHog accepted', async () => {
    const deleter = fakeDeleter()
    await recordAnalyticsDeletion(handle.db, 'aaaaaaaaaaaaaaaaaaaaaaaa', new Date('2026-09-01'))
    await recordAnalyticsDeletion(handle.db, 'bbbbbbbbbbbbbbbbbbbbbbbb', new Date('2026-09-02'))

    const result = await drainAnalyticsDeletions(handle.db, deleter)

    expect(result).toEqual({ deleted: 2, failed: 0 })
    // Oldest first, and the *string* id — the ObjectId form `authId` produces
    // would match nothing at PostHog and report success doing it.
    expect(deleter.calls).toEqual([['aaaaaaaaaaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbbbbbbbbbb']])
    expect(await rows()).toEqual([])
  })

  it('keeps every row when the call fails, and counts the attempt', async () => {
    const deleter = fakeDeleter()
    deleter.failWith = 'PostHog bulk_delete failed: 403'
    await recordAnalyticsDeletion(handle.db, 'cccccccccccccccccccccccc', new Date('2026-09-01'))

    const result = await drainAnalyticsDeletions(handle.db, deleter, {
      now: new Date('2026-09-03T10:00:00.000Z'),
    })

    expect(result).toEqual({ deleted: 0, failed: 1 })
    const [row] = await rows()
    // The account is already gone. If this row went too, the person would
    // survive at PostHog with nothing left anywhere that knows it should not.
    expect(row?._id).toBe('cccccccccccccccccccccccc')
    expect(row?.attempts).toBe(1)
    expect(row?.lastError).toContain('403')
    expect(row?.lastAttemptAt).toEqual(new Date('2026-09-03T10:00:00.000Z'))
  })

  it('retries on the next drain and succeeds', async () => {
    const deleter = fakeDeleter()
    deleter.failWith = 'nope'
    await recordAnalyticsDeletion(handle.db, 'dddddddddddddddddddddddd', new Date('2026-09-01'))
    await drainAnalyticsDeletions(handle.db, deleter)

    deleter.failWith = null
    expect(await drainAnalyticsDeletions(handle.db, deleter)).toEqual({ deleted: 1, failed: 0 })
    expect(await rows()).toEqual([])
  })

  it('calls nothing when the queue is empty', async () => {
    const deleter = fakeDeleter()
    expect(await drainAnalyticsDeletions(handle.db, deleter)).toEqual({ deleted: 0, failed: 0 })
    expect(deleter.calls).toEqual([])
  })

  it('never sends more than one batch, however much is waiting', async () => {
    const deleter = fakeDeleter()
    for (let i = 0; i < 5; i++) {
      await recordAnalyticsDeletion(handle.db, `${i}`.padEnd(24, 'e'), new Date(2026, 8, i + 1))
    }

    const result = await drainAnalyticsDeletions(handle.db, deleter, { limit: 2 })

    expect(result).toEqual({ deleted: 2, failed: 0 })
    expect(deleter.calls).toEqual([['0eeeeeeeeeeeeeeeeeeeeeee', '1eeeeeeeeeeeeeeeeeeeeeee']])
    expect((await rows()).length).toBe(3)
  })
})
