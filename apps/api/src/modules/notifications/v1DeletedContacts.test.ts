import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import {
  claimDeletedContacts,
  dropDeletedContacts,
  pendingDeletedContacts,
  releaseDeletedContacts,
  removeDeletedContact,
  type DeletedContact,
} from './v1DeletedContacts'

describe('the one announcement to v1-deleted accounts', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle

  const contact = (id: string): DeletedContact => ({
    _id: id,
    email: `${id}@example.com`,
    name: id,
    legacyUserId: id,
    recordedAt: new Date(),
  })

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'v1_contacts_test')
  })

  afterAll(async () => {
    await handle.close()
    await mongo.stop()
  })

  beforeEach(async () => {
    await handle.db.collection(COLLECTIONS.v1DeletedContacts).deleteMany({})
    await ensureIndexes(handle.db)
    await handle.db
      .collection<DeletedContact>(COLLECTIONS.v1DeletedContacts)
      .insertMany([contact('a'), contact('b'), contact('c')])
  })

  it('claims each row once, so a re-run cannot send twice', async () => {
    expect((await pendingDeletedContacts(handle.db)).map((c) => c._id)).toEqual(['a', 'b', 'c'])

    expect(await claimDeletedContacts(handle.db, ['a', 'b'])).toEqual(['a', 'b'])
    expect(await claimDeletedContacts(handle.db, ['a', 'b', 'c'])).toEqual(['c'])
    expect(await pendingDeletedContacts(handle.db)).toEqual([])
  })

  it('a released claim is sent to again; a removed address is not', async () => {
    await claimDeletedContacts(handle.db, ['a', 'b'])
    await releaseDeletedContacts(handle.db, ['b'])
    await removeDeletedContact(handle.db, 'c')
    await removeDeletedContact(handle.db, 'c')
    expect((await pendingDeletedContacts(handle.db)).map((c) => c._id)).toEqual(['b'])
  })

  it('refuses to drop while anyone is unsent, then drops', async () => {
    await claimDeletedContacts(handle.db, ['a', 'b'])
    expect(await dropDeletedContacts(handle.db)).toEqual({ dropped: false, unsent: 1 })
    expect(await handle.db.listCollections({ name: COLLECTIONS.v1DeletedContacts }).hasNext()).toBe(
      true,
    )

    await claimDeletedContacts(handle.db, ['c'])
    expect(await dropDeletedContacts(handle.db)).toEqual({ dropped: true, unsent: 0 })
    expect(await handle.db.listCollections({ name: COLLECTIONS.v1DeletedContacts }).hasNext()).toBe(
      false,
    )
    // Dropping what is already gone is not an error either.
    expect(await dropDeletedContacts(handle.db)).toEqual({ dropped: true, unsent: 0 })
  })
})
