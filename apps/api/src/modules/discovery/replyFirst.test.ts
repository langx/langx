import {
  DEFAULT_APP_CONFIG,
  DISCOVERY_DORMANT_DAYS,
  DISCOVERY_NEW_DAYS,
  DISCOVERY_REPLY_SIGNAL_MIN_SAMPLE,
  discoveryQuerySchema,
  type DiscoveryItem,
} from '@langx/shared'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { ObjectId } from 'mongodb'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import { updateAppConfig } from '../appConfig/appConfig'
import { startConversation, type Conversation } from '../chat/conversations'
import { sendTextMessage } from '../chat/messages'
import type { Profile } from '../profiles/profiles'
import { discoverProfiles, newProfiles } from './discovery'

const DAY = 24 * 60 * 60 * 1000

/**
 * Everybody here is Turkish-speaking or English-speaking, and the viewer is a
 * Turkish native learning English — so `mutual` is an English native learning
 * Turkish (score 2) and `oneSided` an English native learning French (score 1).
 * Nobody is online unless a test says so: `lastActiveAt` defaults to an hour
 * ago, which keeps online-first out of every ordering it is not testing.
 */
function person(id: string, fields: Partial<Profile> = {}): Profile {
  const now = Date.now()
  return {
    _id: id,
    handle: id,
    displayName: id,
    birthDate: '1995-06-15',
    gender: 'undisclosed',
    nativeLanguages: [{ code: 'en' }],
    learning: [{ code: 'tr', level: 'intermediate', priority: 1 }],
    interests: [],
    settings: { discoverable: true, notifications: true },
    privacy: { incognito: false },
    entitlement: { tier: 'free', updatedAt: new Date(now) },
    quota: { initiations: [], translations: [], media: [] },
    streak: { current: 0, longest: 0, lastQualifiedDay: null },
    stats: { lastActiveAt: new Date(now - 60 * 60 * 1000), messagesSent: 0 },
    createdAt: new Date(now - 60 * DAY),
    updatedAt: new Date(now),
    ...fields,
  }
}

const oneSided: Partial<Profile> = {
  learning: [{ code: 'fr', level: 'intermediate', priority: 1 }],
}

function idle(days: number): Pick<Profile['stats'], 'lastActiveAt'> {
  return { lastActiveAt: new Date(Date.now() - days * DAY) }
}

function stats(fields: Partial<Profile['stats']>): Pick<Profile, 'stats'> {
  return {
    stats: { lastActiveAt: new Date(Date.now() - 60 * 60 * 1000), messagesSent: 0, ...fields },
  }
}

/** `YYYY-MM-DD` for `years` ago today, plus `extraDays`, counted on the calendar. */
function bornYearsAgo(years: number, extraDays = 0): string {
  const date = new Date()
  date.setUTCFullYear(date.getUTCFullYear() - years)
  date.setUTCDate(date.getUTCDate() + extraDays)
  return date.toISOString().slice(0, 10)
}

describe('reply-first discovery', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_reply_first_test')
    await ensureIndexes(handle.db)
  }, 120_000)

  afterAll(async () => {
    await handle?.close()
    await replSet?.stop()
  })

  beforeEach(async () => {
    for (const name of [
      COLLECTIONS.profiles,
      COLLECTIONS.conversations,
      COLLECTIONS.messages,
      COLLECTIONS.blocks,
      COLLECTIONS.tokenLedger,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
    await setFlag(false)
  })

  async function setFlag(on: boolean) {
    await updateAppConfig(handle.db, {
      flags: { ...DEFAULT_APP_CONFIG.flags, discoveryReplyFirst: on },
    })
  }

  async function seed(...profiles: Profile[]) {
    await handle.db.collection<Profile>(COLLECTIONS.profiles).insertMany([
      person('viewer', {
        nativeLanguages: [{ code: 'tr' }],
        learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
      }),
      ...profiles,
    ])
  }

  async function thread(a: string, b: string, fields: Partial<Conversation> = {}) {
    const now = new Date()
    await handle.db.collection<Conversation>(COLLECTIONS.conversations).insertOne({
      _id: new ObjectId(),
      pairKey: [a, b].sort().join(':'),
      participants: [a, b],
      lastMessage: { body: 'hi', senderId: a, createdAt: now },
      unread: {},
      firstMessageBy: a,
      firstMessageAt: now,
      bothSpoke: false,
      messageCount: 1,
      messageCountBy: { [a]: 1, [b]: 0 },
      createdAt: now,
      updatedAt: now,
      ...fields,
    })
  }

  async function list(qs: Record<string, string> = {}): Promise<DiscoveryItem[]> {
    return (await discoverProfiles(handle.db, 'viewer', discoveryQuerySchema.parse(qs))).items
  }

  async function order(qs: Record<string, string> = {}): Promise<string[]> {
    return (await list(qs)).map((item) => item._id)
  }

  async function strip(viewerId = 'viewer'): Promise<string[]> {
    return (await newProfiles(handle.db, viewerId, discoveryQuerySchema.parse({}))).items.map(
      (item) => item._id,
    )
  }

  describe('with the switch off', () => {
    it('orders exactly as before: partners in, the dormant by score, no reply line', async () => {
      await seed(
        person('partner'),
        person('dormantMutual', {
          stats: { ...idle(DISCOVERY_DORMANT_DAYS + 5), messagesSent: 0 },
        }),
        person('activeOneSided', oneSided),
        person('responder', stats({ openersReceived: 10, openersAnsweredWithinDay: 10 })),
      )
      await thread('viewer', 'partner')

      const items = await list()
      const ids = items.map((item) => item._id)
      expect(ids).toContain('partner')
      expect(ids.indexOf('dormantMutual')).toBeLessThan(ids.indexOf('activeOneSided'))
      expect(items.some((item) => item.repliesWithinDay)).toBe(false)
      expect(await strip()).toEqual([])
    })
  })

  describe('with the switch on', () => {
    beforeEach(async () => {
      await setFlag(true)
    })

    it('leaves out people the viewer already talks to — on the default list only', async () => {
      await seed(person('openedByViewer'), person('openedByThem'), person('stranger'))
      await thread('viewer', 'openedByViewer')
      await thread('openedByThem', 'viewer')

      expect(await order()).toEqual(['stranger'])
      // `active` and `nearby` answer "who is here" and "who is close", and a
      // partner is a true answer to both.
      expect(await order({ sort: 'active' })).toEqual(
        expect.arrayContaining(['openedByViewer', 'openedByThem', 'stranger']),
      )
    })

    it('still leaves out blocked and hidden people, and keeps the viewer off their own list', async () => {
      await seed(
        person('blocked'),
        person('hidden', { settings: { discoverable: false, notifications: true } }),
        person('visible'),
      )
      await handle.db
        .collection(COLLECTIONS.blocks)
        .insertOne({ blockerId: 'blocked', blockedId: 'viewer', createdAt: new Date() })

      expect(await order()).toEqual(['visible'])
    })

    it(`sorts profiles idle past ${DISCOVERY_DORMANT_DAYS} days after active ones, whatever they score`, async () => {
      await seed(
        // Mutual, two shared interests, and gone for weeks.
        person('dormantBestFit', {
          interests: ['music', 'films'],
          stats: { ...idle(DISCOVERY_DORMANT_DAYS + 1), messagesSent: 0 },
        }),
        // Mutual, but only just inside the line.
        person('quietMutual', { stats: { ...idle(DISCOVERY_DORMANT_DAYS - 1), messagesSent: 0 } }),
        person('activeOneSided', oneSided),
        // Online now: the online bucket still leads everything.
        person('onlineOneSided', {
          ...oneSided,
          stats: { lastActiveAt: new Date(), messagesSent: 0 },
        }),
      )
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: 'viewer' }, { $set: { interests: ['music', 'films'] } })

      expect(await order()).toEqual([
        'onlineOneSided',
        'quietMutual',
        'activeOneSided',
        'dormantBestFit',
      ])
    })

    it('weighs answering first messages through a prior, and absent counters sit at the prior', async () => {
      const hourAgo = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000)
      await seed(
        // Oldest activity of the four, so only the term can put it first.
        person('answersMost', {
          stats: {
            lastActiveAt: hourAgo(5),
            messagesSent: 0,
            openersReceived: 10,
            openersAnswered: 9,
          },
        }),
        // Never written to: (0+1)/(0+2), the same as having no counters at all.
        person('noCounters', { stats: { lastActiveAt: hourAgo(3), messagesSent: 0 } }),
        person('zeroCounters', {
          stats: { lastActiveAt: hourAgo(4), messagesSent: 0, openersReceived: 0 },
        }),
        // Most recently active, and answers nobody.
        person('answersNobody', {
          stats: { lastActiveAt: hourAgo(2), messagesSent: 0, openersReceived: 10 },
        }),
        // One-sided and answers everyone: still below every mutual fit.
        person('oneSidedResponder', {
          ...oneSided,
          stats: {
            lastActiveAt: hourAgo(1),
            messagesSent: 0,
            openersReceived: 50,
            openersAnswered: 50,
          },
        }),
      )

      expect(await order()).toEqual([
        'answersMost',
        'noCounters',
        'zeroCounters',
        'answersNobody',
        'oneSidedResponder',
      ])
    })

    it('never reads more answers than first messages as better than always answering', async () => {
      await seed(
        person('always', stats({ openersReceived: 4, openersAnswered: 4 })),
        // Answered outgrew received — two writes split by a failure. Clamped.
        person('impossible', {
          stats: {
            lastActiveAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
            messagesSent: 0,
            openersReceived: 4,
            openersAnswered: 40,
          },
        }),
      )
      expect(await order()).toEqual(['always', 'impossible'])
    })

    it(`says "usually replies within a day" only past ${DISCOVERY_REPLY_SIGNAL_MIN_SAMPLE} first messages, and never as a number`, async () => {
      await seed(
        person('usually', stats({ openersReceived: 6, openersAnsweredWithinDay: 5 })),
        person('tooFew', stats({ openersReceived: 4, openersAnsweredWithinDay: 4 })),
        person('slow', stats({ openersReceived: 10, openersAnswered: 10 })),
        person('hidesStatus', {
          ...stats({ openersReceived: 10, openersAnsweredWithinDay: 10 }),
          privacy: { incognito: false, hideOnlineStatus: true },
        }),
      )

      const items = await list()
      const flagged = items.filter((item) => item.repliesWithinDay).map((item) => item._id)
      expect(flagged).toEqual(['usually'])
      const wire = JSON.stringify(items)
      expect(wire).not.toContain('openers')
      expect(wire).not.toContain('stats')
    })

    it('counts first messages and first replies once each, from the threads opened since', async () => {
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .insertMany([person('ada'), person('bo'), person('cy')])
      const profile = (id: string) =>
        handle.db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: id })

      const { conversation } = await startConversation(handle.db, 'ada', {
        toUserId: 'bo',
        body: 'Merhaba!',
      })
      expect(conversation.firstReplyAt).toBeNull()
      expect((await profile('bo'))?.stats.openersReceived).toBe(1)
      expect((await profile('ada'))?.stats.openersReceived).toBeUndefined()

      const conversationId = conversation._id.toHexString()
      await sendTextMessage(handle.db, 'ada', { conversationId, body: 'Are you there?' })
      expect((await profile('bo'))?.stats.openersAnswered).toBeUndefined()

      await sendTextMessage(handle.db, 'bo', { conversationId, body: 'Hello!' })
      await sendTextMessage(handle.db, 'bo', { conversationId, body: 'Sorry, was out.' })
      const bo = await profile('bo')
      expect(bo?.stats.openersAnswered).toBe(1)
      expect(bo?.stats.openersAnsweredWithinDay).toBe(1)
      const stored = await handle.db
        .collection<Conversation>(COLLECTIONS.conversations)
        .findOne({ _id: conversation._id })
      expect(stored?.firstReplyAt).toBeInstanceOf(Date)

      // A reply two days late counts as answered, not as within a day.
      const late = await startConversation(handle.db, 'cy', { toUserId: 'bo', body: 'Selam' })
      await handle.db
        .collection<Conversation>(COLLECTIONS.conversations)
        .updateOne(
          { _id: late.conversation._id },
          { $set: { firstMessageAt: new Date(Date.now() - 2 * DAY) } },
        )
      await sendTextMessage(handle.db, 'bo', {
        conversationId: late.conversation._id.toHexString(),
        body: 'Hi, late!',
      })
      const after = await profile('bo')
      expect(after?.stats.openersReceived).toBe(2)
      expect(after?.stats.openersAnswered).toBe(2)
      expect(after?.stats.openersAnsweredWithinDay).toBe(1)
    })

    it('counts nothing for a thread that predates the counters', async () => {
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .insertMany([person('ada'), person('bo')])
      const conversationId = new ObjectId()
      await thread('ada', 'bo', { _id: conversationId })

      await sendTextMessage(handle.db, 'bo', {
        conversationId: conversationId.toHexString(),
        body: 'Finally answering',
      })
      const bo = await handle.db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: 'bo' })
      expect(bo?.stats.openersAnswered).toBeUndefined()
      const stored = await handle.db
        .collection<Conversation>(COLLECTIONS.conversations)
        .findOne({ _id: conversationId })
      expect(stored?.bothSpoke).toBe(true)
      expect(stored).not.toHaveProperty('firstReplyAt')
    })
  })

  describe('GET /discovery/new', () => {
    beforeEach(async () => {
      await setFlag(true)
    })

    const joined = (days: number) => ({ createdAt: new Date(Date.now() - days * DAY) })

    it('shows adults who joined recently, newest first, and nobody else', async () => {
      await seed(
        person('newest', { ...joined(1), birthDate: '2000-01-01' }),
        person('older', { ...joined(3), birthDate: '1990-05-05' }),
        person('minor', { ...joined(1), birthDate: bornYearsAgo(17) }),
        person('longAgo', { ...joined(DISCOVERY_NEW_DAYS + 1) }),
        person('hidden', {
          ...joined(1),
          settings: { discoverable: false, notifications: true },
        }),
        person('partner', joined(1)),
        person('blocker', joined(1)),
      )
      await thread('partner', 'viewer')
      await handle.db
        .collection(COLLECTIONS.blocks)
        .insertOne({ blockerId: 'viewer', blockedId: 'blocker', createdAt: new Date() })

      expect(await strip()).toEqual(['newest', 'older'])
    })

    it('draws the adult line on the birthday itself, not on the year', async () => {
      await seed(
        person('eighteenToday', { ...joined(1), birthDate: bornYearsAgo(18) }),
        person('eighteenTomorrow', { ...joined(1), birthDate: bornYearsAgo(18, 1) }),
      )
      expect(await strip()).toEqual(['eighteenToday'])
    })

    it('is empty for a viewer under 18', async () => {
      await seed(person('newcomer', joined(1)))
      await handle.db
        .collection<Profile>(COLLECTIONS.profiles)
        .updateOne({ _id: 'viewer' }, { $set: { birthDate: bornYearsAgo(17) } })
      expect(await strip()).toEqual([])
    })

    it('is empty with the switch off', async () => {
      await seed(person('newcomer', joined(1)))
      await setFlag(false)
      expect(await strip()).toEqual([])
    })

    it('is served by an index, not a collection scan', async () => {
      await seed(person('newcomer', joined(1)))
      const explain = await handle.db
        .collection(COLLECTIONS.profiles)
        .aggregate([
          {
            $match: {
              $and: [
                {
                  _id: { $nin: ['viewer'] },
                  'settings.discoverable': true,
                  deletedAt: { $exists: false },
                  $or: [
                    { 'nativeLanguages.code': { $in: ['en'] } },
                    { 'learning.code': { $in: ['tr'] } },
                  ],
                },
                {
                  _id: { $nin: [] },
                  createdAt: { $gte: new Date(Date.now() - DISCOVERY_NEW_DAYS * DAY) },
                  birthDate: { $lte: bornYearsAgo(18) },
                },
              ],
            },
          },
          { $sort: { createdAt: -1, _id: 1 } },
          { $limit: 12 },
        ])
        .explain('executionStats')
      const serialized = JSON.stringify(explain, (key: string, value: unknown) =>
        key === 'rejectedPlans' ? undefined : value,
      )
      expect(serialized).toContain('IXSCAN')
      expect(serialized).not.toContain('COLLSCAN')
    })
  })
})
