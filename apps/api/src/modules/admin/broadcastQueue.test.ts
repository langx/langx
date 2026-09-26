import { SUSPENSION_FOREVER } from '@langx/shared'
import type { Db } from 'mongodb'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import {
  createBroadcast,
  broadcasts,
  deleteBroadcast,
  getBroadcast,
  markBroadcastTested,
  setBroadcastStatus,
  updateBroadcastBodies,
} from './broadcast'
import { runBroadcastQueuePass, sendBroadcastTest } from './broadcastQueue'
import { ensureOfficialAccounts } from '../official/accounts'
import { deliverOfficialMessage } from '../official/deliver'
import type { Profile } from '../profiles/profiles'
import { LoggingPushSender, type PushSender } from '../push/devices'

/** Nothing is registered for push in here, so this is never asked to send. */
const push: PushSender = {
  send: () => Promise.resolve({ invalidTokens: [] }),
}

/**
 * Arms a draft the way the panel does: the test send first, because
 * `draft → queued` is refused without it. Every test below is about the queue
 * rather than that gate, so it lives here instead of in each of them.
 */
async function arm(db: Db, id: string): Promise<void> {
  await markBroadcastTested(db, id)
  await setBroadcastStatus(db, id, 'queued')
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
      db.collection(COLLECTIONS.devices).deleteMany({}),
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
    await arm(db, 'hello')

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
    await arm(db, 'replay')
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
    await arm(db, 'narrow')

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

    await arm(db, 'held')
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
    await arm(db, 'night')

    const threeAm = new Date('2026-09-13T03:00:00.000Z')
    expect(await runBroadcastQueuePass(db, push, threeAm)).toEqual({ sent: 0 })
    expect(await db.collection(COLLECTIONS.jobRuns).countDocuments({ job: 'broadcastQueue' })).toBe(
      0,
    )
    expect(await runBroadcastQueuePass(db, push, NOON)).toEqual({ sent: 1 })
  })

  it('sends the test again after an edit, rather than the body that was fixed', async () => {
    await member('operator')
    await createBroadcast(db, {
      id: 'typo',
      bodies: { en: 'Somehting new' },
      pushTitle: 'LangX',
      createdBy: 'test',
    })

    const first = await getBroadcast(db, 'typo')
    expect(await sendBroadcastTest(db, push, first!, 'operator')).toBe(true)

    await updateBroadcastBodies(db, 'typo', { en: 'Something new' })
    const second = await getBroadcast(db, 'typo')
    expect(await sendBroadcastTest(db, push, second!, 'operator')).toBe(true)

    /*
     * Two messages, not one. Without the `rev` in the clientId the second is
     * refused as a duplicate and `deliverOfficialMessage` hands back the first
     * — so the operator reads the typo again and nothing says it happened.
     */
    expect(await messagesSent()).toBe(2)
    const bodies = await db
      .collection<{ body: string }>(COLLECTIONS.messages)
      .find({})
      .map((row) => row.body)
      .toArray()
    expect(bodies.sort()).toEqual(['Somehting new', 'Something new'])
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
    await arm(db, 'localised')
    await runBroadcastQueuePass(db, push, NOON)

    const bodies = await db
      .collection<{ body: string }>(COLLECTIONS.messages)
      .find({})
      .map((row) => row.body)
      .toArray()
    expect(bodies.sort()).toEqual(['Hello', 'Merhaba'])
  })

  it('carries the picture for the reader’s own language, English otherwise', async () => {
    await Promise.all([
      member('painter', { nativeLanguages: [{ code: 'tr' }] }),
      member('sculptor', { nativeLanguages: [{ code: 'el' }] }),
    ])
    const picture = (name: string) => ({
      url: `https://media.langx.io/broadcasts/${name}.png`,
      contentType: 'image/png',
      sizeBytes: 1234,
      width: 1200,
      height: 675,
    })
    await createBroadcast(db, {
      id: 'illustrated',
      bodies: { en: 'A chart', tr: 'Bir grafik' },
      images: { en: picture('en'), tr: picture('tr') },
      pushTitle: 'LangX',
      createdBy: 'test',
    })
    await arm(db, 'illustrated')
    await runBroadcastQueuePass(db, push, NOON)

    const messages = await db
      .collection<{ body: string; type: string; media?: { url: string }; attachments?: unknown[] }>(
        COLLECTIONS.messages,
      )
      .find({})
      .toArray()

    // A picture with a caption is an image message, not a text one — or the
    // chat list row and the bubble both draw the wrong thing.
    expect(messages.map((row) => row.type)).toEqual(['image', 'image'])
    // Written twice: `attachments` for current builds, `media` for the ones
    // that predate the list.
    expect(messages.every((row) => row.attachments?.length === 1)).toBe(true)
    expect(messages.map((row) => row.media?.url).sort()).toEqual([
      'https://media.langx.io/broadcasts/en.png',
      'https://media.langx.io/broadcasts/tr.png',
    ])
  })

  it('falls back to the English picture for a language that has none', async () => {
    await member('greekpainter', { nativeLanguages: [{ code: 'el' }] })
    await createBroadcast(db, {
      id: 'one-picture',
      bodies: { en: 'A chart' },
      images: {
        en: {
          url: 'https://media.langx.io/broadcasts/only.png',
          contentType: 'image/png',
          sizeBytes: 10,
        },
      },
      pushTitle: 'LangX',
      createdBy: 'test',
    })
    await arm(db, 'one-picture')
    await runBroadcastQueuePass(db, push, NOON)

    const message = await db
      .collection<{ media?: { url: string } }>(COLLECTIONS.messages)
      .findOne({})
    expect(message?.media?.url).toBe('https://media.langx.io/broadcasts/only.png')
  })

  /**
   * The bug that hid a picture: a draft deleted and written again under the
   * same slug started at `rev` 1, so its test send carried the clientId the
   * previous draft's test had already used. The message row outlives the job
   * row, `deliverOfficialMessage` handed the old one back, and the panel
   * showed the new draft as tested while nothing had arrived.
   */
  it('tests a draft written again under a slug that was already tested', async () => {
    await member('secondlook')
    const first = await createBroadcast(db, {
      id: 'rewritten',
      bodies: { en: 'The first draft' },
      pushTitle: 'LangX',
      createdBy: 'test',
    })
    expect(await sendBroadcastTest(db, push, first, 'secondlook')).toBe(true)
    await deleteBroadcast(db, 'rewritten')

    const second = await createBroadcast(db, {
      id: 'rewritten',
      bodies: { en: 'The second draft, with a picture' },
      images: {
        en: {
          url: 'https://media.langx.io/broadcasts/second.png',
          contentType: 'image/png',
          sizeBytes: 10,
        },
      },
      pushTitle: 'LangX',
      createdBy: 'test',
    })
    expect(await sendBroadcastTest(db, push, second, 'secondlook')).toBe(true)

    const bodies = await db
      .collection<{ body: string }>(COLLECTIONS.messages)
      .find({})
      .map((row) => row.body)
      .toArray()
    expect(bodies.sort()).toEqual(['The first draft', 'The second draft, with a picture'])
  })

  /**
   * The test send is the only preview, so it has to be a preview of the whole
   * message. One without the picture would leave the operator arming a draft
   * whose picture nobody has seen — which is the hole the test send exists to
   * close, reopened one field at a time.
   */
  it('sends the picture to the operator too', async () => {
    await member('operator')
    const job = await createBroadcast(db, {
      id: 'tested-picture',
      bodies: { en: 'A chart' },
      images: {
        en: {
          url: 'https://media.langx.io/broadcasts/preview.png',
          contentType: 'image/png',
          sizeBytes: 10,
        },
      },
      pushTitle: 'LangX',
      createdBy: 'test',
    })

    expect(await sendBroadcastTest(db, push, job, 'operator')).toBe(true)
    const message = await db
      .collection<{ media?: { url: string }; type: string }>(COLLECTIONS.messages)
      .findOne({})
    expect(message?.type).toBe('image')
    expect(message?.media?.url).toBe('https://media.langx.io/broadcasts/preview.png')
  })

  /**
   * Muting @langx withholds the knock and not the message: the thread is
   * where a broadcast lives, and somebody who muted it still finds it there.
   */
  it('writes to a reader who muted @langx, and does not push them', async () => {
    await Promise.all([member('anna'), member('bruno')])
    await db.collection(COLLECTIONS.devices).insertMany(
      ['anna', 'bruno'].map((userId) => ({
        userId,
        deviceId: `phone-${userId}`,
        pushToken: `token-${userId}`,
        platform: 'ios',
        createdAt: NOON,
        updatedAt: NOON,
      })),
    )
    await deliverOfficialMessage(db, { fromHandle: 'langx', toUserId: 'anna', body: 'Welcome' })
    await db
      .collection(COLLECTIONS.conversations)
      .updateOne({ participants: 'anna' }, { $set: { 'mutedBy.anna': true } })
    await createBroadcast(db, {
      id: 'muted',
      bodies: { en: 'Something new' },
      pushTitle: 'LangX',
      createdBy: 'test',
    })
    await arm(db, 'muted')

    const pushes = new LoggingPushSender()
    expect(await runBroadcastQueuePass(db, pushes, NOON)).toEqual({ sent: 2 })
    expect(pushes.sent.flatMap((message) => message.to)).toEqual(['token-bruno'])
    expect(
      await db
        .collection(COLLECTIONS.messages)
        .countDocuments({ clientId: 'broadcast:muted:anna' }),
    ).toBe(1)
  })
})
