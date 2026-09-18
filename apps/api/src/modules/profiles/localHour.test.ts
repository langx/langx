import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from './profiles'
import { profilesInLocalHour } from './localHour'

describe('the profiles whose own clock reads a given hour', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle
  const now = new Date('2026-09-14T14:00:00Z')

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'local_hour_test')
  })

  afterAll(async () => {
    await handle.close()
    await mongo.stop()
  })

  beforeEach(async () => {
    await handle.db.collection(COLLECTIONS.profiles).deleteMany({})
  })

  async function insert(id: string, extra: Partial<Profile> = {}): Promise<void> {
    await handle.db.collection<Profile>(COLLECTIONS.profiles).insertOne({
      _id: id,
      handle: id,
      displayName: id,
      birthDate: '2000-01-01',
      gender: 'undisclosed',
      createdAt: now,
      updatedAt: now,
      ...extra,
    } as Profile)
  }

  it('keeps whoever is at that hour and leaves the other zones alone', async () => {
    await insert('utc', { timezone: 'UTC' })
    await insert('tokyo', { timezone: 'Asia/Tokyo' })

    const due = await profilesInLocalHour(handle.db, 14, now, {})

    expect(due.map((profile) => profile._id)).toEqual(['utc'])
  })

  /*
   * The case the two-step could have lost. `distinct` reports a missing field
   * as `null`, and a zone nobody stored has to keep meaning UTC — the same
   * thing `timezone ?? 'UTC'` says everywhere else.
   */
  it('treats a profile with no zone as UTC', async () => {
    await insert('nozone')

    const due = await profilesInLocalHour(handle.db, 14, now, {})

    expect(due.map((profile) => profile._id)).toEqual(['nozone'])
  })

  it('applies the caller’s filter, not only the hour', async () => {
    await insert('live', { timezone: 'UTC' })
    await insert('gone', { timezone: 'UTC', deletedAt: now })

    const due = await profilesInLocalHour(handle.db, 14, now, {
      deletedAt: { $exists: false },
    })

    expect(due.map((profile) => profile._id)).toEqual(['live'])
  })

  it('asks nothing further when no zone is at that hour', async () => {
    await insert('utc', { timezone: 'UTC' })

    expect(await profilesInLocalHour(handle.db, 3, now, {})).toEqual([])
  })
})
