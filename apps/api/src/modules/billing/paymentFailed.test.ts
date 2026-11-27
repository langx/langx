import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StoredPlanTier } from '@langx/shared'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import type { EmailMessage, EmailSender } from '../../email/sender'
import { translator } from '../../i18n'
import type { Profile } from '../profiles/profiles'
import type { BillingNotifier } from './notify'
import { runPaymentFailedPass } from './paymentFailed'
import { PLAN_ENDED_DELAY_MS, PLAN_ENDED_MAX_AGE_MS } from './planEnded'
import type { SubscriptionRecord } from './webhook'

const NOW = new Date('2026-11-27T15:30:00Z')
const LATE = PLAN_ENDED_DELAY_MS + 60_000

function minimalProfile(id: string, tier: StoredPlanTier): Profile {
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
    entitlement: { tier, updatedAt: NOW },
    quota: { initiations: [], translations: [], media: [] },
    streak: { current: 0, longest: 0, lastQualifiedDay: null },
    stats: { lastActiveAt: NOW, messagesSent: 0 },
    createdAt: NOW,
    updatedAt: NOW,
  }
}

describe('the payment-failed letter, said only while it is true', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle
  let sent: EmailMessage[]
  let senders: BillingNotifier

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'payment_failed_test')
  })

  afterAll(async () => {
    await handle.close()
    await mongo.stop()
  })

  beforeEach(async () => {
    for (const name of [
      COLLECTIONS.user,
      COLLECTIONS.profiles,
      COLLECTIONS.subscriptions,
      COLLECTIONS.notificationLedger,
    ]) {
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

  async function member(tier: StoredPlanTier): Promise<string> {
    const _id = new ObjectId()
    const userId = _id.toHexString()
    await handle.db
      .collection(COLLECTIONS.user)
      .insertOne({ _id, email: `${userId}@example.com`, emailVerified: true })
    await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .insertOne(minimalProfile(userId, tier))
    return userId
  }

  async function logged(
    userId: string,
    type: string,
    agoMs: number,
    extra: Partial<SubscriptionRecord> = {},
  ): Promise<void> {
    const createdAt = new Date(NOW.getTime() - agoMs)
    await handle.db.collection<SubscriptionRecord>(COLLECTIONS.subscriptions).insertOne({
      eventId: new ObjectId().toHexString(),
      userId,
      type,
      store: 'APP_STORE',
      productId: 'langx_pro_monthly',
      expiresAt: new Date(createdAt.getTime() + 3 * 24 * 60 * 60 * 1000),
      environment: 'PRODUCTION',
      createdAt,
      ...extra,
    })
  }

  it('writes once to a member still on their plan half an hour later', async () => {
    const userId = await member('pro')
    await logged(userId, 'BILLING_ISSUE', LATE)

    expect(await runPaymentFailedPass(handle.db, senders, NOW)).toEqual({ sent: 1 })
    expect(sent[0]?.to).toBe(`${userId}@example.com`)
    expect(sent[0]?.subject).toBe(translator('tr')('email.billing.paymentFailedTitle'))

    expect(
      await runPaymentFailedPass(handle.db, senders, new Date(NOW.getTime() + 29 * 60_000)),
    ).toEqual({ sent: 0 })
    expect(sent).toHaveLength(1)
  })

  it('waits the half hour first', async () => {
    const userId = await member('pro')
    await logged(userId, 'BILLING_ISSUE', PLAN_ENDED_DELAY_MS - 60_000)

    expect(await runPaymentFailedPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
  })

  /**
   * The 21–27 November 2026 case: a web trial's first charge failed an hour
   * before the trial ended, and the expiry came in the same second with the
   * period still an hour away — so the event alone looked like a retry.
   */
  it('says nothing to a web trial whose failed charge ended the plan', async () => {
    const userId = await member('free')
    await logged(userId, 'BILLING_ISSUE', LATE, {
      store: 'RC_BILLING',
      expiresAt: new Date(NOW.getTime() + 60 * 60_000),
    })

    expect(await runPaymentFailedPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
  })

  it('says nothing once the retry renewed the plan', async () => {
    const userId = await member('pro')
    await logged(userId, 'BILLING_ISSUE', LATE)
    await logged(userId, 'RENEWAL', LATE - 5 * 60_000)

    expect(await runPaymentFailedPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
  })

  it('says nothing about a period already over when the event came', async () => {
    const userId = await member('pro')
    await logged(userId, 'BILLING_ISSUE', LATE, {
      expiresAt: new Date(NOW.getTime() - LATE - 29_000),
    })

    expect(await runPaymentFailedPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
  })

  it('says nothing about sandbox, or an issue older than a day', async () => {
    const tester = await member('pro')
    await logged(tester, 'BILLING_ISSUE', LATE, { environment: 'SANDBOX' })
    const old = await member('pro')
    await logged(old, 'BILLING_ISSUE', PLAN_ENDED_MAX_AGE_MS + 60_000)

    expect(await runPaymentFailedPass(handle.db, senders, NOW)).toEqual({ sent: 0 })
  })
})
