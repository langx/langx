import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import type * as DefaultAvatarModule from './defaultAvatar'
import { setGender } from './profiles'

// The face move fails; the gender change it follows must not.
vi.mock('./defaultAvatar', async (original) => ({
  ...(await original<typeof DefaultAvatarModule>()),
  onGenderChange: vi.fn().mockRejectedValue(new Error('face store down')),
}))

let replSet: MongoMemoryReplSet
let handle: DbHandle

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
  handle = await connectToDatabase(replSet.getUri(), 'langx_set_gender_avatar_test')
}, 120_000)

afterAll(async () => {
  await handle?.close()
  await replSet?.stop()
})

describe('setGender when the drawn face cannot move', () => {
  it('saves the gender, keeps the old face and reports success', async () => {
    const id = '64f1c0ff0000000000000abc'
    const face = { pool: 'M', index: 4, ground: 2 }
    await handle.db
      .collection(COLLECTIONS.profiles)
      .insertOne({ _id: id, handle: 'mover', gender: 'male', defaultAvatar: face } as never)
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const updated = await setGender(handle.db, id, 'female')

    expect(updated.gender).toBe('female')
    expect(updated.defaultAvatar).toEqual(face)
    expect(errors).toHaveBeenCalled()
    errors.mockRestore()
  })
})
