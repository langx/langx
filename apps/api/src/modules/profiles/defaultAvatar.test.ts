import { hashFallback, type DefaultAvatar, type Gender } from '@langx/shared'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import {
  assignDefaultAvatar,
  defaultAvatarRevFor,
  getDefaultAvatarFor,
  onGenderChange,
  pickDefaultAvatar,
} from './defaultAvatar'
import { backfillDefaultAvatars } from './defaultAvatarBackfill'
import type { Profile } from './profiles'

let replSet: MongoMemoryReplSet
let handle: DbHandle

/** Ascending 24-hex ids, so `_id` order is creation order as with ObjectIds. */
let next = 0x100
function newId(): string {
  next += 1
  return `64f1c0ff00000000${next.toString(16).padStart(8, '0')}`
}

async function insert(fields: Partial<Profile> & { gender: Gender }): Promise<string> {
  const _id = newId()
  await handle.db
    .collection(COLLECTIONS.profiles)
    .insertOne({ _id, handle: `h${_id}`, ...fields } as never)
  return _id
}

async function stored(id: string): Promise<DefaultAvatar | undefined> {
  const row = await handle.db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: id })
  return row?.defaultAvatar
}

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
  handle = await connectToDatabase(replSet.getUri(), 'langx_default_avatar_test')
}, 120_000)

afterAll(async () => {
  await handle?.close()
  await replSet?.stop()
})

beforeEach(async () => {
  await handle.db.collection(COLLECTIONS.profiles).deleteMany({})
})

describe('assignDefaultAvatar', () => {
  it('spreads consecutive sign-ups over every face before repeating one', async () => {
    const faces: number[] = []
    for (let i = 0; i < 96; i++) {
      const id = await insert({ gender: 'female' })
      const avatar = await assignDefaultAvatar(handle.db, id)
      expect(avatar?.pool).toBe('W')
      faces.push(avatar?.index ?? 0)
    }
    // Least used over the window: the first 48 are all different faces, and
    // the next 48 use each one exactly once more.
    expect(new Set(faces.slice(0, 48)).size).toBe(48)
    const counts = new Map<number, number>()
    for (const index of faces) counts.set(index, (counts.get(index) ?? 0) + 1)
    expect([...counts.values()].every((count) => count === 2)).toBe(true)
  })

  it('draws from the pool of the gender, and the neutral pool for both private answers', async () => {
    const expected: [Gender, string][] = [
      ['female', 'W'],
      ['male', 'M'],
      ['other', 'N'],
      ['undisclosed', 'N'],
    ]
    for (const [gender, pool] of expected) {
      const id = await insert({ gender })
      expect((await assignDefaultAvatar(handle.db, id))?.pool).toBe(pool)
    }
  })

  it('assigns once and never reshuffles', async () => {
    const id = await insert({ gender: 'male' })
    const first = await assignDefaultAvatar(handle.db, id)
    await insert({ gender: 'male' })
    expect(await assignDefaultAvatar(handle.db, id)).toEqual(first)
    expect(await stored(id)).toEqual(first)
  })

  it('skips official accounts and guests', async () => {
    const official = await insert({ gender: 'undisclosed', official: true })
    const guest = await insert({ gender: 'undisclosed', guest: true })
    expect(await assignDefaultAvatar(handle.db, official)).toBeNull()
    expect(await assignDefaultAvatar(handle.db, guest)).toBeNull()
    expect(await stored(official)).toBeUndefined()
    expect(await stored(guest)).toBeUndefined()
  })
})

describe('onGenderChange', () => {
  const genders: Gender[] = ['female', 'male', 'other', 'undisclosed']
  const poolOf: Record<Gender, string> = { female: 'W', male: 'M', other: 'N', undisclosed: 'N' }

  for (const from of genders) {
    for (const to of genders) {
      if (from === to) continue
      it(`moves an assigned face from ${from} to ${to}, keeping index and ground`, async () => {
        const id = await insert({ gender: from })
        const before = await assignDefaultAvatar(handle.db, id)
        const after = await onGenderChange(handle.db, id, to)
        expect(after).toEqual({ ...before, pool: poolOf[to] })
        expect(await stored(id)).toEqual(after)
      })
    }
  }

  it('keeps a face the person picked', async () => {
    const id = await insert({ gender: 'male' })
    await assignDefaultAvatar(handle.db, id)
    const picked = await pickDefaultAvatar(handle.db, id, { pool: 'N', index: 12 })
    expect(await onGenderChange(handle.db, id, 'female')).toBeNull()
    expect(await stored(id)).toEqual(picked)
  })

  it('leaves an unassigned profile to its hash, which follows the gender by itself', async () => {
    const id = await insert({ gender: 'male' })
    expect(await onGenderChange(handle.db, id, 'female')).toBeNull()
    expect(await stored(id)).toBeUndefined()
  })
})

describe('pickDefaultAvatar', () => {
  it('stores the choice as picked, on the ground the profile already had', async () => {
    const id = await insert({ gender: 'female' })
    const assigned = await assignDefaultAvatar(handle.db, id)
    const picked = await pickDefaultAvatar(handle.db, id, { pool: 'M', index: 3 })
    expect(picked).toEqual({ pool: 'M', index: 3, ground: assigned?.ground, picked: true })
    const onGround = await pickDefaultAvatar(handle.db, id, { pool: 'W', index: 9, ground: 5 })
    expect(onGround).toEqual({ pool: 'W', index: 9, ground: 5, picked: true })
  })

  it('refuses an official account', async () => {
    const id = await insert({ gender: 'undisclosed', official: true })
    await expect(pickDefaultAvatar(handle.db, id, { pool: 'N', index: 1 })).rejects.toThrow()
  })
})

describe('reading the face', () => {
  it('reads the stored face, or the hash of the id in its pool, or the neutral hash', async () => {
    const id = await insert({ gender: 'female' })
    expect(await getDefaultAvatarFor(handle.db, id)).toEqual(hashFallback(id, 'female'))
    const assigned = await assignDefaultAvatar(handle.db, id)
    expect(await getDefaultAvatarFor(handle.db, id)).toEqual(assigned)
    const nobody = newId()
    expect(await getDefaultAvatarFor(handle.db, nobody)).toEqual(hashFallback(nobody, null))
  })

  it('names a face only for a profile without a photo that is not official', () => {
    const base = { _id: newId(), gender: 'male' as const }
    expect(defaultAvatarRevFor(base)).toMatch(/^1-M\d\d-\d$/)
    expect(defaultAvatarRevFor({ ...base, avatarUrl: 'https://media.example/a.jpg' })).toBe(
      undefined,
    )
    expect(defaultAvatarRevFor({ ...base, official: true })).toBe(undefined)
    expect(
      defaultAvatarRevFor({ ...base, defaultAvatar: { pool: 'N', index: 9, ground: 4 } }),
    ).toBe('1-N09-4')
  })
})

describe('backfillDefaultAvatars', () => {
  it('writes nothing on a dry run, fills the gaps on --apply, and nothing the second time', async () => {
    const photoless = await Promise.all([
      insert({ gender: 'female' }),
      insert({ gender: 'male' }),
      insert({ gender: 'undisclosed' }),
    ])
    const withPhoto = await insert({ gender: 'female', avatarUrl: 'https://media.example/b.jpg' })
    const official = await insert({ gender: 'undisclosed', official: true })
    const kept = await insert({ gender: 'male' })
    const keptFace = await pickDefaultAvatar(handle.db, kept, { pool: 'W', index: 5 })

    const dry = await backfillDefaultAvatars(handle.db, { apply: false })
    expect(dry).toMatchObject({ scanned: 5, missing: 3, written: 0 })
    for (const id of photoless) expect(await stored(id)).toBeUndefined()

    const applied = await backfillDefaultAvatars(handle.db, { apply: true })
    expect(applied).toMatchObject({ missing: 3, written: 3 })
    expect((await stored(photoless[0] ?? ''))?.pool).toBe('W')
    expect((await stored(photoless[1] ?? ''))?.pool).toBe('M')
    expect((await stored(photoless[2] ?? ''))?.pool).toBe('N')
    expect(await stored(withPhoto)).toBeUndefined()
    expect(await stored(official)).toBeUndefined()
    expect(await stored(kept)).toEqual(keptFace)

    expect(await backfillDefaultAvatars(handle.db, { apply: true })).toMatchObject({
      missing: 0,
      written: 0,
    })
  })
})
