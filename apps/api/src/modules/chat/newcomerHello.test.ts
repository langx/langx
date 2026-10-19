import { DEFAULT_APP_CONFIG, NEWCOMER_HELLO_RULES, PLAN_LIMITS } from '@langx/shared'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { MongoServerError, ObjectId, type Db } from 'mongodb'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import { ApiError } from '../../lib/ApiError'
import { updateAppConfig } from '../appConfig/appConfig'
import type { Profile } from '../profiles/profiles'
import { startConversation } from './conversations'
import { newcomerHelloIsFree, newcomerHelloOpen } from './newcomerHello'

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000

/**
 * An adult on the free plan, discoverable, with an account two months old —
 * somebody a hello to is never free. `newcomer` below is the same person a day
 * after signing up.
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
    stats: { lastActiveAt: new Date(now - HOUR), messagesSent: 0 },
    createdAt: new Date(now - 60 * DAY),
    updatedAt: new Date(now),
    ...fields,
  }
}

function newcomer(id: string, fields: Partial<Profile> = {}): Profile {
  return person(id, { createdAt: new Date(Date.now() - DAY), ...fields })
}

/**
 * `YYYY-MM-DD` for `years` ago today (UTC), plus `extraDays`. A 29 February
 * today becomes the 28th in a year without one, for `replyFirst.test.ts`'s
 * reason: rolling into March would make "eighteen today" seventeen.
 */
function bornYearsAgo(years: number, extraDays = 0): string {
  const today = new Date()
  const year = today.getUTCFullYear() - years
  const month = today.getUTCMonth()
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const day = Math.min(today.getUTCDate(), lastDayOfMonth)
  return new Date(Date.UTC(year, month, day + extraDays)).toISOString().slice(0, 10)
}

/** `count` timestamps inside the last day: a free account with that many new chats spent. */
function spentChats(count: number): Date[] {
  return Array.from({ length: count }, (_, i) => new Date(Date.now() - (i + 1) * HOUR))
}

/** A free account that has started every new chat it may today. */
function outOfChats(id: string): Profile {
  const limit = PLAN_LIMITS.free.initiationsPer24h ?? 0
  return person(id, { quota: { initiations: spentChats(limit), translations: [], media: [] } })
}

/**
 * The same database with `conversations.insertOne` failing — the one write a
 * free hello pays for, made to fail after the hello is spent.
 */
function failingInsert(db: Db, error: Error): Db {
  return new Proxy(db, {
    get(target, prop) {
      if (prop === 'collection') {
        return (name: string) => {
          const collection = target.collection(name)
          if (name !== COLLECTIONS.conversations) return collection
          return new Proxy(collection, {
            get(inner, key) {
              if (key === 'insertOne') return () => Promise.reject(error)
              const value: unknown = Reflect.get(inner, key, inner)
              if (typeof value !== 'function') return value
              return (value as (...args: unknown[]) => unknown).bind(inner)
            },
          })
        }
      }
      const value: unknown = Reflect.get(target, prop, target)
      if (typeof value !== 'function') return value
      return (value as (...args: unknown[]) => unknown).bind(target)
    },
  })
}

describe('the newcomer hello', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_newcomer_hello_test')
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
    await updateAppConfig(handle.db, { flags: { ...DEFAULT_APP_CONFIG.flags, newcomerHello: on } })
  }

  async function seed(...profiles: Profile[]) {
    await handle.db.collection<Profile>(COLLECTIONS.profiles).insertMany(profiles)
  }

  /** What the sender has spent: new chats in the window, and newcomer hellos stored. */
  async function spent(id: string) {
    const profile = await handle.db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: id })
    const since = Date.now() - DAY
    return {
      chats: (profile?.quota.initiations ?? []).filter((d) => new Date(d).getTime() >= since)
        .length,
      hellos: profile?.newcomerHellos ?? [],
    }
  }

  function start(from: string, to: string, db: Db = handle.db) {
    return startConversation(db, from, { toUserId: to, body: 'hello' })
  }

  async function refusal(promise: Promise<unknown>): Promise<string> {
    const caught = await promise.then(
      () => null,
      (error: unknown) => error,
    )
    if (!(caught instanceof ApiError))
      throw new Error(`expected an ApiError, got ${String(caught)}`)
    return caught.code
  }

  describe('with the switch off', () => {
    it('counts a hello to a newcomer like any first message, and stores nothing new', async () => {
      await seed(person('me'), newcomer('nina'))

      await start('me', 'nina')

      const after = await spent('me')
      expect(after.chats).toBe(1)
      expect(after.hellos).toEqual([])
      const raw = await handle.db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: 'me' })
      expect(raw && 'newcomerHellos' in raw).toBe(false)
    })

    it('refuses the first message past the allowance, newcomer or not', async () => {
      await seed(outOfChats('me'), newcomer('nina'))

      expect(await refusal(start('me', 'nina'))).toBe('QUOTA_EXCEEDED')
      expect(await handle.db.collection(COLLECTIONS.conversations).countDocuments()).toBe(0)
    })

    it('never calls a hello free', async () => {
      const me = person('me')
      const nina = newcomer('nina')
      expect(newcomerHelloOpen(me, nina, new Date())).toBe(true)
      expect(await newcomerHelloIsFree(handle.db, me, nina, new Date())).toBe(false)
    })
  })

  describe('with the switch on', () => {
    beforeEach(async () => {
      await setFlag(true)
    })

    it('lets somebody with no new chats left say hello to a newcomer', async () => {
      await seed(outOfChats('me'), newcomer('nina'))

      const { conversation } = await start('me', 'nina')

      expect(conversation.participants).toEqual(['me', 'nina'])
      const after = await spent('me')
      expect(after.chats).toBe(PLAN_LIMITS.free.initiationsPer24h)
      expect(after.hellos.map((h) => h.to)).toEqual(['nina'])
    })

    it('does not touch the new chats of somebody who still has some', async () => {
      await seed(person('me'), newcomer('nina'))

      await start('me', 'nina')

      expect((await spent('me')).chats).toBe(0)
    })

    it('is free once per recipient: a second first message to them counts', async () => {
      await seed(person('me'), newcomer('nina'))
      await start('me', 'nina')
      // The thread gone — nothing in the app deletes one, so this is the only
      // way a second first message to the same person can exist at all.
      await handle.db.collection(COLLECTIONS.conversations).deleteMany({})

      await start('me', 'nina')

      const after = await spent('me')
      expect(after.chats).toBe(1)
      expect(after.hellos).toHaveLength(1)
    })

    it('ends with the seventh day', async () => {
      const window = NEWCOMER_HELLO_RULES.newForDays * DAY
      await seed(
        person('me'),
        person('justNew', { createdAt: new Date(Date.now() - window + 60_000) }),
        person('justOld', { createdAt: new Date(Date.now() - window - 60_000) }),
      )

      await start('me', 'justNew')
      expect(await spent('me')).toMatchObject({ chats: 0 })

      await start('me', 'justOld')
      const after = await spent('me')
      expect(after.chats).toBe(1)
      expect(after.hellos.map((h) => h.to)).toEqual(['justNew'])
    })

    it('never reaches a 16- or 17-year-old, at either end', async () => {
      await seed(
        person('me'),
        newcomer('seventeen', { birthDate: bornYearsAgo(18, 1) }),
        newcomer('eighteen', { birthDate: bornYearsAgo(18) }),
        person('minor', { birthDate: bornYearsAgo(17) }),
        newcomer('nina'),
      )

      // Eighteen tomorrow is seventeen today: counted.
      await start('me', 'seventeen')
      expect((await spent('me')).chats).toBe(1)
      // Eighteen today is an adult: free.
      await start('me', 'eighteen')
      expect((await spent('me')).chats).toBe(1)
      // A minor's own first messages count as they always have.
      await start('minor', 'nina')
      expect(await spent('minor')).toEqual({ chats: 1, hellos: [] })
    })

    it('never applies to a guest, at either end', async () => {
      await seed(
        person('me'),
        newcomer('guestRecipient', {
          guest: true,
          birthDate: '1900-01-01',
          settings: { discoverable: false } as Profile['settings'],
        }),
        person('guestSender', { guest: true, birthDate: '1900-01-01' }),
        newcomer('nina'),
      )

      await start('me', 'guestRecipient')
      expect(await spent('me')).toEqual({ chats: 1, hellos: [] })
      await start('guestSender', 'nina')
      expect(await spent('guestSender')).toEqual({ chats: 1, hellos: [] })
    })

    it('never applies to somebody hidden from Discover', async () => {
      await seed(
        person('me'),
        newcomer('hidden', { settings: { discoverable: false } as Profile['settings'] }),
      )

      await start('me', 'hidden')

      expect(await spent('me')).toEqual({ chats: 1, hellos: [] })
    })

    it('still refuses a blocked pair, either way, and spends nothing on it', async () => {
      await seed(person('me'), newcomer('blocker'), newcomer('blocked'))
      await handle.db.collection(COLLECTIONS.blocks).insertMany([
        { _id: new ObjectId(), blockerId: 'blocker', blockedId: 'me', createdAt: new Date() },
        { _id: new ObjectId(), blockerId: 'me', blockedId: 'blocked', createdAt: new Date() },
      ])

      expect(await refusal(start('me', 'blocker'))).toBe('BLOCKED')
      expect(await refusal(start('me', 'blocked'))).toBe('BLOCKED')
      expect(await spent('me')).toEqual({ chats: 0, hellos: [] })
    })

    it('stops at the ceiling, and past it a hello counts like any other', async () => {
      const ceiling = NEWCOMER_HELLO_RULES.perSenderPer24h
      const newcomers = Array.from({ length: ceiling + 1 }, (_, i) => newcomer(`new${i}`))
      await seed(person('me'), ...newcomers)

      for (const someone of newcomers) await start('me', someone._id)

      const after = await spent('me')
      expect(after.hellos).toHaveLength(ceiling)
      expect(after.chats).toBe(1)
    })

    it('counts the ceiling over a rolling day, and forgets what no newcomer can need', async () => {
      const ceiling = NEWCOMER_HELLO_RULES.perSenderPer24h
      const earlier = [
        // Inside the day: these fill the ceiling but one.
        ...Array.from({ length: ceiling - 1 }, (_, i) => ({
          to: `today${i}`,
          at: new Date(Date.now() - (i + 1) * HOUR),
        })),
        // Yesterday: not counted, still kept.
        { to: 'yesterday', at: new Date(Date.now() - 2 * DAY) },
        // Older than any newcomer: pruned by the next write.
        { to: 'lastMonth', at: new Date(Date.now() - 30 * DAY) },
      ]
      await seed(person('me', { newcomerHellos: earlier }), newcomer('nina'), newcomer('omar'))

      await start('me', 'nina')
      await start('me', 'omar')

      const after = await spent('me')
      expect(after.hellos.map((h) => h.to).sort()).toEqual(
        [...earlier.slice(0, ceiling - 1).map((h) => h.to), 'yesterday', 'nina'].sort(),
      )
      expect(after.chats).toBe(1)
    })

    it('gives the hello back when the conversation is not started', async () => {
      await seed(outOfChats('me'), newcomer('nina'))
      const raced = new MongoServerError({
        message: 'E11000 duplicate key error index: pair_key_unique',
        code: 11000,
      })

      expect(await refusal(start('me', 'nina', failingInsert(handle.db, raced)))).toBe(
        'CONVERSATION_EXISTS',
      )
      expect((await spent('me')).hellos).toEqual([])

      await expect(
        start('me', 'nina', failingInsert(handle.db, new Error('connection reset'))),
      ).rejects.toThrow('connection reset')
      expect((await spent('me')).hellos).toEqual([])

      // Still there to spend.
      await start('me', 'nina')
      expect((await spent('me')).hellos.map((h) => h.to)).toEqual(['nina'])
    })

    it('lets concurrent starts take the last free hello exactly once', async () => {
      const ceiling = NEWCOMER_HELLO_RULES.perSenderPer24h
      const earlier = Array.from({ length: ceiling - 1 }, (_, i) => ({
        to: `today${i}`,
        at: new Date(Date.now() - (i + 1) * HOUR),
      }))
      const newcomers = Array.from({ length: 4 }, (_, i) => newcomer(`new${i}`))
      await seed(person('me', { newcomerHellos: earlier }), ...newcomers)

      const results = await Promise.allSettled(newcomers.map((n) => start('me', n._id)))

      expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
      const after = await spent('me')
      expect(after.hellos).toHaveLength(ceiling)
      expect(after.chats).toBe(newcomers.length - 1)
    })

    it('two concurrent starts to one newcomer open one thread and spend one hello at most', async () => {
      await seed(person('me'), newcomer('nina'))

      const results = await Promise.allSettled([start('me', 'nina'), start('me', 'nina')])

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      expect(await handle.db.collection(COLLECTIONS.conversations).countDocuments()).toBe(1)
      expect((await spent('me')).hellos.length).toBeLessThanOrEqual(1)
    })

    it('leaves Pro alone: nothing to spare, nothing written', async () => {
      await seed(
        person('me', { entitlement: { tier: 'pro', updatedAt: new Date() } }),
        newcomer('nina'),
      )

      await start('me', 'nina')

      expect(await spent('me')).toEqual({ chats: 0, hellos: [] })
    })

    it('says a hello is free only where the start would make it free', async () => {
      const now = new Date()
      const nina = newcomer('nina')
      expect(await newcomerHelloIsFree(handle.db, person('me'), nina, now)).toBe(true)
      expect(
        newcomerHelloOpen(person('me', { newcomerHellos: [{ to: 'nina', at: now }] }), nina, now),
      ).toBe(false)
      expect(
        newcomerHelloOpen(
          person('me', {
            newcomerHellos: Array.from(
              { length: NEWCOMER_HELLO_RULES.perSenderPer24h },
              (_, i) => ({
                to: `x${i}`,
                at: new Date(now.getTime() - HOUR),
              }),
            ),
          }),
          nina,
          now,
        ),
      ).toBe(false)
      expect(
        newcomerHelloOpen(
          person('me'),
          newcomer('closed', { privacy: { refuseNewChats: true } as Profile['privacy'] }),
          now,
        ),
      ).toBe(false)
      expect(
        newcomerHelloOpen(
          person('me'),
          newcomer('suspended', {
            suspension: {
              at: now,
              until: new Date(now.getTime() + DAY),
              permanent: false,
              reason: 'spam',
            },
          }),
          now,
        ),
      ).toBe(false)
    })
  })
})
