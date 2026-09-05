import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import type { Profile } from '../profiles/profiles'
import {
  getViewers,
  recordProfileView,
  SESSION_GAP_MS,
  viewSummarySince,
  type ProfileView,
} from './profileViews'

/**
 * Enough of a profile to be looked at and to look. Everything the module
 * reads is here; the rest is whatever the type needs to be satisfied.
 */
function profile(overrides: Partial<Profile> & { _id: string }): Profile {
  const now = new Date('2026-09-01T00:00:00Z')
  return {
    handle: overrides._id,
    displayName: overrides._id.toUpperCase(),
    birthDate: '1995-06-15',
    gender: 'undisclosed',
    nativeLanguages: [{ code: 'tr' }],
    learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
    interests: [],
    settings: { discoverable: true, notifications: true },
    privacy: { incognito: false },
    entitlement: { tier: 'pro_plus', updatedAt: now },
    quota: { initiations: [], translations: [], media: [] },
    createdAt: now,
    ...overrides,
  } as Profile
}

const DAY = new Date('2026-09-05T12:00:00Z')
const at = (offsetMs: number) => new Date(DAY.getTime() + offsetMs)
const MIN = 60 * 1000

describe('profile views, a row per day', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle

  const me = profile({ _id: 'me' })
  const xue = profile({ _id: 'xue', displayName: 'xue' })
  const guest = profile({ _id: 'g1', guest: true, handle: 'guest:g1', displayName: '' })

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_profile_views_test')
    await ensureIndexes(handle.db)
  })

  afterAll(async () => {
    await handle.close()
    await replSet.stop()
  })

  beforeEach(async () => {
    await handle.db.collection(COLLECTIONS.profileViews).deleteMany({})
    await handle.db.collection(COLLECTIONS.profiles).deleteMany({})
    await handle.db.collection<Profile>(COLLECTIONS.profiles).insertMany([me, xue, guest])
  })

  it('folds views inside the session gap into one visit, and starts a new visit after it', async () => {
    await recordProfileView(handle.db, xue, 'me', at(0))
    await recordProfileView(handle.db, xue, 'me', at(1 * MIN))
    await recordProfileView(handle.db, xue, 'me', at(3 * MIN))

    let rows = await handle.db.collection<ProfileView>(COLLECTIONS.profileViews).find().toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ day: '2026-09-05', count: 1 })
    expect(rows[0]!.lastViewedAt).toEqual(at(3 * MIN))

    await recordProfileView(handle.db, xue, 'me', at(3 * MIN + SESSION_GAP_MS + 1))
    rows = await handle.db.collection<ProfileView>(COLLECTIONS.profileViews).find().toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]!.count).toBe(2)
  })

  it('opens a second row on the next UTC day', async () => {
    await recordProfileView(handle.db, xue, 'me', at(0))
    await recordProfileView(handle.db, xue, 'me', at(13 * 60 * MIN))

    const rows = await handle.db
      .collection<ProfileView>(COLLECTIONS.profileViews)
      .find()
      .sort({ day: 1 })
      .toArray()
    expect(rows.map((row) => [row.day, row.count])).toEqual([
      ['2026-09-05', 1],
      ['2026-09-06', 1],
    ])
  })

  it('lists a day per row, counts people once, and names a guest as a guest', async () => {
    await recordProfileView(handle.db, xue, 'me', at(-24 * 60 * MIN))
    await recordProfileView(handle.db, xue, 'me', at(0))
    await recordProfileView(handle.db, guest, 'me', at(5 * MIN))

    const summary = await getViewers(handle.db, 'me', { limit: 20 }, at(10 * MIN))
    expect(summary.total).toBe(2)
    expect(summary.locked).toBe(false)
    expect(summary.viewers.map((row) => [row.userId, row.day, row.viewCount])).toEqual([
      ['g1', '2026-09-05', 1],
      ['xue', '2026-09-05', 1],
      ['xue', '2026-09-04', 1],
    ])
    const guestRow = summary.viewers[0]!
    expect(guestRow.guest).toBe(true)
    expect(guestRow.handle).toBeUndefined()
    expect(guestRow.displayName).toBeUndefined()
    expect(summary.viewers[1]).toMatchObject({ handle: 'xue', displayName: 'xue' })
  })

  it('sums visits per day for the last seven days on the first page only', async () => {
    await recordProfileView(handle.db, xue, 'me', at(-3 * 24 * 60 * MIN))
    await recordProfileView(handle.db, xue, 'me', at(0))
    await recordProfileView(handle.db, guest, 'me', at(1 * MIN))
    // A row from before the day column existed: grouped by its timestamp.
    await handle.db.collection<ProfileView>(COLLECTIONS.profileViews).insertOne({
      viewerId: 'old',
      viewedId: 'me',
      firstViewedAt: at(-24 * 60 * MIN),
      lastViewedAt: at(-24 * 60 * MIN),
      count: 4,
    } as ProfileView)

    const first = await getViewers(handle.db, 'me', { limit: 2 }, at(10 * MIN))
    expect(first.week?.map((day) => day.visits)).toEqual([0, 0, 0, 1, 0, 4, 2])
    expect(first.week?.at(-1)?.day).toBe('2026-09-05')
    expect(first.nextCursor).not.toBeNull()

    const second = await getViewers(
      handle.db,
      'me',
      { limit: 2, cursor: first.nextCursor! },
      at(10 * MIN),
    )
    expect(second.week).toBeUndefined()
  })

  it('reports people, not rows, to the digest — and never names a guest', async () => {
    await recordProfileView(handle.db, xue, 'me', at(-24 * 60 * MIN))
    await recordProfileView(handle.db, xue, 'me', at(0))
    await recordProfileView(handle.db, guest, 'me', at(1 * MIN))

    const summary = await viewSummarySince(handle.db, 'me', at(-2 * 24 * 60 * MIN))
    expect(summary).toEqual({ count: 2, viewers: [{ displayName: 'xue' }] })
  })
})
