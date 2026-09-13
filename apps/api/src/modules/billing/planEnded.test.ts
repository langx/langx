import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import type { EmailMessage, EmailSender } from '../../email/sender'
import type { PlanTier } from '@langx/shared'
import type { Profile } from '../profiles/profiles'
import { runPlanEndedPass, PLAN_ENDED_DELAY_MS, PLAN_ENDED_MAX_AGE_MS } from './planEnded'
import type { BillingNotifier } from './notify'

const NOW = new Date('2026-09-14T12:00:00Z')

function minimalProfile(id: string): Profile {
  return {
    _id: id,
    handle: id,
    displayName: id,
    birthDate: '1995-06-15',
    gender: 'undisclosed',
    nativeLanguages: [{ code: 'tr' }],
    learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
    interests: [],
    settings: { discoverable: true, notifications: true },
    privacy: { incognito: false },
    entitlement: { tier: 'free', updatedAt: NOW },
    quota: { initiations: [], translations: [], media: [] },
    streak: { current: 0, longest: 0, lastQualifiedDay: null },
    stats: { lastActiveAt: NOW, messagesSent: 0 },
    createdAt: NOW,
    updatedAt: NOW,
  }
}

describe('the letter that waits for the renewal that never came', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle
  let sent: EmailMessage[]
  let senders: BillingNotifier

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'plan_ended_test')
  }, 60_000)

  afterAll(async () => {
    await handle.close()
    await mongo.stop()
  })

  beforeEach(async () => {
    for (const name of [COLLECTIONS.user, COLLECTIONS.profiles, COLLECTIONS.notificationLedger]) {
      await handle.db.collection(name).deleteMany({})
    }
    sent = []
    const email: EmailSender = {
      deliverable: true,
      send: (message) => {
        sent.push(message)
        return Promise.resolve()
      },
    }
    senders = {
      email,
      push: { send: () => Promise.resolve({ invalidTokens: [] }) },
      logger: { error: vi.fn() },
    }
  })

  /** A verified address, since that is the only kind `notifyBilling` writes to. */
  async function churnedUser(
    opts: { agoMs: number; tier?: PlanTier; nowTier?: PlanTier } = { agoMs: 0 },
  ): Promise<string> {
    const _id = new ObjectId()
    const userId = _id.toHexString()
    await handle.db
      .collection(COLLECTIONS.user)
      .insertOne({ _id, email: `${userId}@example.com`, emailVerified: true })
    await handle.db.collection<Profile>(COLLECTIONS.profiles).insertOne({
      ...minimalProfile(userId),
      entitlement: { tier: opts.nowTier ?? 'free', updatedAt: NOW },
      churnedFrom: { tier: opts.tier ?? 'pro', at: new Date(NOW.getTime() - opts.agoMs) },
    })
    return userId
  }

  it('says nothing in the half hour a late renewal still has to arrive', async () => {
    await churnedUser({ agoMs: PLAN_ENDED_DELAY_MS - 60_000 })

    expect(await runPlanEndedPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
    expect(sent).toHaveLength(0)
  })

  /**
   * The 12 September 2026 case, which is the reason this pass exists: the
   * expiry was real, the alarm was not. The webhook has already put the
   * account back on `pro_plus` by the time this runs, and `churnedFrom` is
   * still sitting there because nothing ever clears it.
   */
  it('says nothing when the renewal did arrive', async () => {
    await churnedUser({
      agoMs: PLAN_ENDED_DELAY_MS + 60_000,
      tier: 'pro_plus',
      nowTier: 'pro_plus',
    })

    expect(await runPlanEndedPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
    expect(sent).toHaveLength(0)
  })

  it('writes once to somebody still free half an hour later, and never again', async () => {
    const userId = await churnedUser({ agoMs: PLAN_ENDED_DELAY_MS + 60_000, tier: 'pro_plus' })

    expect(await runPlanEndedPass(handle.db, senders, NOW)).toEqual({ sent: 1 })
    expect(sent).toHaveLength(1)
    expect(sent[0]?.to).toBe(`${userId}@example.com`)

    // The ledger claim is keyed on the fall, not on the day, so a second tick
    // twenty-nine minutes later must find it already spent.
    expect(
      await runPlanEndedPass(handle.db, senders, new Date(NOW.getTime() + 29 * 60_000)),
    ).toEqual({ sent: 0 })
    expect(sent).toHaveLength(1)
  })

  /**
   * `churnedFrom` is never cleared, so without the far end the first run of
   * this pass after it ships would write to everybody who has ever cancelled.
   */
  it('says nothing about a churn older than a day', async () => {
    await churnedUser({ agoMs: PLAN_ENDED_MAX_AGE_MS + 60_000 })

    expect(await runPlanEndedPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
    expect(sent).toHaveLength(0)
  })

  it('says nothing to a deleted account', async () => {
    const userId = await churnedUser({ agoMs: PLAN_ENDED_DELAY_MS + 60_000 })
    await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .updateOne({ _id: userId }, { $set: { deletedAt: NOW } })

    expect(await runPlanEndedPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
    expect(sent).toHaveLength(0)
  })
})
