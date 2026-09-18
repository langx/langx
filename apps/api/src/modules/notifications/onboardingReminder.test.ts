import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import { authId } from '../../lib/authId'
import {
  isOldEnough,
  isReminderCandidate,
  reminderCohort,
  reminderVariant,
} from './onboardingReminder'

const NOW = new Date('2026-09-10T12:00:00.000Z')
const hoursAgo = (hours: number): Date => new Date(NOW.getTime() - hours * 3600_000)

describe('which letter a stalled signup gets', () => {
  it('sends the wizard reminder to a confirmed address', () => {
    expect(reminderVariant({ emailVerified: true })).toBe('reminder')
  })

  /**
   * `auth.ts` sets `requireEmailVerification`, so this person cannot sign in at
   * all. "Finish setting up your profile" would point them at a wall.
   */
  it('sends the confirm-first letter to an address nobody proved', () => {
    expect(reminderVariant({ emailVerified: false })).toBe('confirm')
    expect(reminderVariant({})).toBe('confirm')
  })
})

describe('who counts as a stalled signup', () => {
  it('accepts an ordinary account', () => {
    expect(isReminderCandidate({ _id: '1', email: 'a@b.test' })).toBe(true)
  })

  it('refuses a guest — a browsing session is not a signup', () => {
    expect(isReminderCandidate({ _id: '1', email: 'a@b.test', isAnonymous: true })).toBe(false)
    expect(isReminderCandidate({ _id: '1', email: 'anon-1@guest.langx.invalid' })).toBe(false)
  })

  it('refuses a v1 row, which nobody signed up for and nobody abandoned', () => {
    expect(isReminderCandidate({ _id: '1', email: 'a@b.test', precreatedFromV1: {} })).toBe(false)
  })

  it('refuses the account the API opens at every boot', () => {
    expect(isReminderCandidate({ _id: '1', email: 'warmup@internal.langx.invalid' })).toBe(false)
  })

  it('keeps a real address that merely looks synthetic', () => {
    expect(isReminderCandidate({ _id: '1', email: 'not.langx.invalid@example.test' })).toBe(true)
  })

  it('refuses a row with no address to write to', () => {
    expect(isReminderCandidate({ _id: '1' })).toBe(false)
  })
})

describe('the age floor', () => {
  it('leaves alone somebody who may still be filling the form', () => {
    expect(isOldEnough({ createdAt: hoursAgo(2) }, NOW, 24)).toBe(false)
  })

  it('includes somebody who put their phone down a day ago', () => {
    expect(isOldEnough({ createdAt: hoursAgo(25) }, NOW, 24)).toBe(true)
  })

  it('is a flag, so a first manual run can reach further back', () => {
    expect(isOldEnough({ createdAt: hoursAgo(20) }, NOW, 24)).toBe(false)
    expect(isOldEnough({ createdAt: hoursAgo(20) }, NOW, 12)).toBe(true)
  })

  it('refuses a row with no signup date rather than guessing one', () => {
    expect(isOldEnough({}, NOW, 24)).toBe(false)
  })
})

describe('reading the cohort out of the database', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'onboarding_reminder_test')
    await ensureIndexes(handle.db)
  })

  afterAll(async () => {
    await handle.close()
    await mongo.stop()
  })

  beforeEach(async () => {
    for (const name of [COLLECTIONS.profiles, COLLECTIONS.user]) {
      await handle.db.collection(name).deleteMany({})
    }
  })

  async function signUp(
    opts: {
      onboarded?: boolean
      verified?: boolean
      anonymous?: boolean
      fromV1?: boolean
      email?: string
      name?: string
      hoursOld?: number
    } = {},
  ): Promise<string> {
    const userId = new ObjectId().toHexString()
    if (opts.onboarded) {
      await handle.db
        .collection(COLLECTIONS.profiles)
        .insertOne({ _id: userId, handle: `h${userId.slice(-12)}`, displayName: 'Sofia' } as never)
    }
    await handle.db.collection(COLLECTIONS.user).insertOne({
      _id: authId(userId),
      email: opts.email ?? `${userId}@example.test`,
      emailVerified: opts.verified ?? true,
      createdAt: hoursAgo(opts.hoursOld ?? 48),
      ...(opts.name ? { name: opts.name } : {}),
      ...(opts.anonymous ? { isAnonymous: true } : {}),
      ...(opts.fromV1 ? { precreatedFromV1: { at: new Date() } } : {}),
    })
    return userId
  }

  it('returns the person who signed up and never finished', async () => {
    const stalled = await signUp({ name: '  Manon  ' })
    await signUp({ onboarded: true })

    const cohort = await reminderCohort(handle.db, { now: NOW })
    expect(cohort).toHaveLength(1)
    expect(cohort[0]?.userId).toBe(stalled)
    expect(cohort[0]?.variant).toBe('reminder')
    expect(cohort[0]?.name).toBe('Manon')
  })

  /**
   * The join that decides the whole cohort. `user._id` is an ObjectId and
   * `profiles._id` is its string form — matching them the wrong way round
   * would find no profiles at all and mail every member the product has.
   */
  it('does not mistake an onboarded member for a drop-off', async () => {
    await signUp({ onboarded: true })
    await signUp({ onboarded: true })
    expect(await reminderCohort(handle.db, { now: NOW })).toEqual([])
  })

  it('splits the two letters by whether the address was ever confirmed', async () => {
    await signUp({ verified: true, hoursOld: 72 })
    await signUp({ verified: false, hoursOld: 71 })

    const cohort = await reminderCohort(handle.db, { now: NOW })
    expect(cohort.map((r) => r.variant)).toEqual(['reminder', 'confirm'])
  })

  it('leaves out guests, v1 rows and anybody still mid-form', async () => {
    await signUp({ anonymous: true })
    await signUp({ fromV1: true })
    await signUp({ email: 'anon-9@guest.langx.invalid' })
    await signUp({ hoursOld: 1 })
    expect(await reminderCohort(handle.db, { now: NOW })).toEqual([])
  })

  it('is ordered oldest first, so a limited run starts with the longest wait', async () => {
    await signUp({ hoursOld: 30, email: 'newer@example.test' })
    await signUp({ hoursOld: 90, email: 'older@example.test' })

    const cohort = await reminderCohort(handle.db, { now: NOW })
    expect(cohort.map((r) => r.email)).toEqual(['older@example.test', 'newer@example.test'])

    const limited = await reminderCohort(handle.db, { now: NOW, limit: 1 })
    expect(limited.map((r) => r.email)).toEqual(['older@example.test'])
  })
})
