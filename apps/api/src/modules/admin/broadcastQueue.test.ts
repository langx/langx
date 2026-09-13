import { SUSPENSION_FOREVER } from '@langx/shared'
import type { Db } from 'mongodb'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import { createBroadcast, broadcasts, setBroadcastStatus } from './broadcast'
import { runBroadcastQueuePass } from './broadcastQueue'
import { ensureOfficialAccounts } from '../official/accounts'
import type { Profile } from '../profiles/profiles'
import type { PushSender } from '../push/devices'

/** Nothing is registered for push in here, so this is never asked to send. */
const push: PushSender = {
  send: () => Promise.resolve({ invalidTokens: [] }),
}

/** Inside `BROADCAST_SEND_WINDOW_UTC`, which is the only clock this cares about. */
const NOON = new Date('2026-09-13T12:00:00.000Z')
const HALF_PAST = new Date('2026-09-13T12:30:00.000Z')

describe('the in-app broadcast queue', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let db: Db

  /**
   * Profiles written straight in rather than onboarded: this exercises the
   * queue, and a page of real sign-ups would be a minute of setup for a fact
   * none of these tests are about.
   */
  async function member(id: string, overrides: Partial<Profile> = {}): Promise<string> {
    await db.collection<Profile>(COLLECTIONS.profiles).insertOne({
      _id: id,
      handle: id,
      displayName: id,
      gender: 'undisclosed',
      nativeLanguages: [{ code: 'en' }],
      learning: [{ code: 'tr', level: 'beginner', priority: 1 }],
      settings: { discoverable: true },
      stats: { lastActiveAt: NOON, messagesSent: 0 },
      createdAt: NOON,
      updatedAt: NOON,
      ...overrides,
    } as Profile)
    return id
  }

  const messagesSent = () =>
    db.collection(COLLECTIONS.messages).countDocuments({ type: { $ne: 'system' } })

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_broadcast_test')
    db = handle.db
    await ensureIndexes(db)
    await ensureOfficialAccounts(db, 'http://localhost:4000')
  }, 120_000)

  afterAll(async () => {
    await handle?.close()
    await replSet?.stop()
  })

  beforeEach(async () => {
    await Promise.all([
      broadcasts(db).deleteMany({}),
      db.collection(COLLECTIONS.jobRuns).deleteMany({}),
      db.collection(COLLECTIONS.messages).deleteMany({}),
      db.collection(COLLECTIONS.conversations).deleteMany({}),
      db.collection<Profile>(COLLECTIONS.profiles).deleteMany({ official: { $exists: false } }),
    ])
  })

  it('sends to everybody once, and only once, however often the pass runs', async () => {
    await Promise.all([member('anna'), member('bruno'), member('carla')])
    await createBroadcast(db, {
      id: 'hello',
      bodies: { en: 'Something new' },
      pushTitle: 'LangX',
      createdBy: 'test',
    })
    await setBroadcastStatus(db, 'hello', 'queued')

    expect(await runBroadcastQueuePass(db, push, NOON)).toEqual({ sent: 3 })
    expect(await messagesSent()).toBe(3)

    /*
     * The same tick again. The `jobRuns` lock is what refuses it — two API
     * instances reach this together and only one does the work.
     */
    expect(await runBroadcastQueuePass(db, push, NOON)).toEqual({ sent: 0 })
    expect(await messagesSent()).toBe(3)

    // A later tick finds nobody past the cursor and finishes.
    expect(await runBroadcastQueuePass(db, push, HALF_PAST)).toEqual({ sent: 0 })
    expect(await messagesSent()).toBe(3)
    expect((await broadcasts(db).findOne({ _id: 'hello' }))?.status).toBe('done')
  })

  it('is exactly once even when a batch is replayed from the start', async () => {
    await Promise.all([member('dora'), member('emil')])
    await createBroadcast(db, {
      id: 'replay',
      bodies: { en: 'Twice would be wrong' },
      pushTitle: 'LangX',
      createdBy: 'test',
    })
    await setBroadcastStatus(db, 'replay', 'queued')
    await runBroadcastQueuePass(db, push, NOON)
    expect(await messagesSent()).toBe(2)

    /*
     * A crash between the sends and the cursor write, simulated: the cursor is
     * rolled back and the next tick walks the same people again. Every write is
     * refused by `messages.sender_client_id_unique`, so this is the assertion
     * that the clientId carries the recipient — with one shared id the first
     * person would be messaged and the rest silently skipped, which is what
     * happened once, to 25 people.
     *
     * Asserted on the message count rather than on what the pass returned:
     * `deliverOfficialMessage` hands back the message it found, so a duplicate
     * looks like a success from the caller's side.
     */
    await broadcasts(db).updateOne(
      { _id: 'replay' },
      { $unset: { cursorUserId: '' }, $set: { sent: 0 } },
    )
    await runBroadcastQueuePass(db, push, HALF_PAST)
    expect(await messagesSent()).toBe(2)
  })

  it('leaves out guests, suspended, deleted and official accounts', async () => {
    await Promise.all([
      member('real'),
      member('guest', { guest: true }),
      member('gone', { deletedAt: NOON }),
      member('banned', {
        suspension: {
          at: NOON,
          until: new Date(SUSPENSION_FOREVER),
          permanent: true,
          reason: 'spam',
        },
      }),
    ])
    await createBroadcast(db, {
      id: 'narrow',
      bodies: { en: 'Only for the living' },
      pushTitle: 'LangX',
      createdBy: 'test',
    })
    await setBroadcastStatus(db, 'narrow', 'queued')

    expect(await runBroadcastQueuePass(db, push, NOON)).toEqual({ sent: 1 })
    const recipients = await db
      .collection<{ participants?: string[] }>(COLLECTIONS.conversations)
      .find({})
      .toArray()
    expect(recipients.flatMap((row) => row.participants ?? []).includes('banned')).toBe(false)
  })

  it('sends nothing while it is a draft, and nothing once it is paused', async () => {
    await member('frida')
    await createBroadcast(db, {
      id: 'held',
      bodies: { en: 'Not yet' },
      pushTitle: 'LangX',
      createdBy: 'test',
    })

    // A draft is invisible to the queue: arming it is a separate request, which
    // is the whole reason a stray tap cannot broadcast.
    expect(await runBroadcastQueuePass(db, push, NOON)).toEqual({ sent: 0 })
    expect(await messagesSent()).toBe(0)

    await setBroadcastStatus(db, 'held', 'queued')
    await setBroadcastStatus(db, 'held', 'paused')
    expect(await runBroadcastQueuePass(db, push, HALF_PAST)).toEqual({ sent: 0 })
    expect(await messagesSent()).toBe(0)
  })

  it('sends nothing outside the window, without consuming the tick', async () => {
    await member('greta')
    await createBroadcast(db, {
      id: 'night',
      bodies: { en: 'Not at 3am' },
      pushTitle: 'LangX',
      createdBy: 'test',
    })
    await setBroadcastStatus(db, 'night', 'queued')

    const threeAm = new Date('2026-09-13T03:00:00.000Z')
    expect(await runBroadcastQueuePass(db, push, threeAm)).toEqual({ sent: 0 })
    expect(await db.collection(COLLECTIONS.jobRuns).countDocuments({ job: 'broadcastQueue' })).toBe(
      0,
    )
    expect(await runBroadcastQueuePass(db, push, NOON)).toEqual({ sent: 1 })
  })

  it('writes each recipient the body in their own language, English otherwise', async () => {
    await Promise.all([
      member('turk', { nativeLanguages: [{ code: 'tr' }] }),
      member('greek', { nativeLanguages: [{ code: 'el' }] }),
    ])
    await createBroadcast(db, {
      id: 'localised',
      bodies: { en: 'Hello', tr: 'Merhaba' },
      pushTitle: 'LangX',
      createdBy: 'test',
    })
    await setBroadcastStatus(db, 'localised', 'queued')
    await runBroadcastQueuePass(db, push, NOON)

    const bodies = await db
      .collection<{ body: string }>(COLLECTIONS.messages)
      .find({})
      .map((row) => row.body)
      .toArray()
    expect(bodies.sort()).toEqual(['Hello', 'Merhaba'])
  })
})
