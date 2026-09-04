import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import { authId } from '../../lib/authId'
import { DEFAULT_NOTIFICATION_PREFS } from '@langx/shared'
import { audienceAction, audiencePlan } from './audience'

describe('what a Resend audience should contain', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'audience_test')
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

  async function newAccount(
    opts: {
      notifications?: unknown
      verified?: boolean
      deleted?: boolean
      fromV1?: boolean
      profile?: boolean
      anonymous?: boolean
      email?: string
    } = {},
  ): Promise<string> {
    const userId = new ObjectId().toHexString()
    if (opts.profile !== false) {
      await handle.db.collection(COLLECTIONS.profiles).insertOne({
        _id: userId,
        handle: `h${userId.slice(-12)}`,
        displayName: 'Sofia R.',
        settings: { discoverable: true, notifications: opts.notifications ?? {} },
        ...(opts.deleted ? { deletedAt: new Date() } : {}),
      } as never)
    }
    await handle.db.collection(COLLECTIONS.user).insertOne({
      _id: authId(userId),
      email: opts.email ?? `${userId}@example.com`,
      emailVerified: opts.verified ?? true,
      ...(opts.anonymous ? { isAnonymous: true } : {}),
      ...(opts.fromV1 ? { precreatedFromV1: { at: new Date(), legacyUserId: 'v1id' } } : {}),
    })
    return userId
  }

  const optedIn = { promotions: { push: false, email: true } }

  it('takes only a recorded yes when that is all that is claimed', async () => {
    const yes = await newAccount({ notifications: optedIn })
    await newAccount()
    await newAccount({ fromV1: true })

    const plan = await audiencePlan(handle.db, 'consented')
    expect(plan.contacts.map((contact) => contact.userId)).toEqual([yes])
    expect(plan.skipped.noConsent).toBe(2)
  })

  it('adds the v1 accounts that never answered, under the v1 source', async () => {
    const yes = await newAccount({ notifications: optedIn })
    const v1 = await newAccount({ fromV1: true })
    await newAccount()

    const plan = await audiencePlan(handle.db, 'v1')
    expect(new Set(plan.contacts.map((contact) => contact.userId))).toEqual(new Set([yes, v1]))
  })

  /**
   * The case the whole flag exists to get right. Consent given at v1's
   * sign-up stands in for a switch nobody has touched — it does not stand
   * over one somebody has turned off.
   */
  it('never subscribes a v1 account that has since said no', async () => {
    const refused = await newAccount({
      fromV1: true,
      notifications: { promotions: { email: false } },
    })
    const silenced = await newAccount({ fromV1: true, notifications: false })

    const plan = await audiencePlan(handle.db, 'all')
    expect(plan.contacts.find((contact) => contact.userId === refused)?.action).toBe('unsubscribe')
    expect(plan.contacts.find((contact) => contact.userId === silenced)?.action).toBe('unsubscribe')
  })

  /**
   * The one that would have gone wrong quietly. `createProfile` stores the
   * defaults in full, so a returning v1 user carries `promotions.email:
   * false` the moment they finish onboarding — and reading that as a refusal
   * would unsubscribe them from the list their v1 sign-up put them on,
   * without anybody having said anything.
   */
  it('does not read the defaults it writes as a refusal', async () => {
    const onboarded = await newAccount({
      fromV1: true,
      notifications: DEFAULT_NOTIFICATION_PREFS,
    })

    const plan = await audiencePlan(handle.db, 'v1')
    expect(plan.contacts).toEqual([
      expect.objectContaining({ userId: onboarded, action: 'subscribe' }),
    ])
  })

  it('reads the same cell as a refusal once anything else was moved', async () => {
    const chose = await newAccount({
      fromV1: true,
      notifications: {
        ...DEFAULT_NOTIFICATION_PREFS,
        messages: { push: false, email: false },
      },
    })

    const plan = await audiencePlan(handle.db, 'v1')
    expect(plan.contacts).toEqual([
      expect.objectContaining({ userId: chose, action: 'unsubscribe' }),
    ])
  })

  it('carries a pre-created row that has no profile at all', async () => {
    const precreated = await newAccount({ fromV1: true, profile: false })

    const plan = await audiencePlan(handle.db, 'v1')
    expect(plan.contacts.map((contact) => contact.userId)).toEqual([precreated])
    expect(plan.contacts[0]?.name).toBeUndefined()
  })

  it('takes a deleted account off the list rather than silencing it', async () => {
    const gone = await newAccount({ notifications: optedIn, deleted: true })

    const plan = await audiencePlan(handle.db, 'consented')
    expect(plan.contacts).toEqual([expect.objectContaining({ userId: gone, action: 'remove' })])
  })

  it('excludes guests and addresses nobody proved', async () => {
    await newAccount({ notifications: optedIn, verified: false })
    await newAccount({ notifications: optedIn, anonymous: true, email: 'g@guest.langx.invalid' })

    const plan = await audiencePlan(handle.db, 'all')
    expect(plan.contacts).toHaveLength(0)
    expect(plan.skipped).toEqual({ unverified: 1, guest: 1, noConsent: 0 })
  })
})

describe('audienceAction', () => {
  const account = { deleted: false, fromV1: false, prefs: undefined }

  it('reads a bare boolean per kind as silence, not as consent to mail', () => {
    expect(audienceAction('consented', { ...account, prefs: { promotions: true } })).toBeNull()
    expect(audienceAction('v1', { ...account, fromV1: true, prefs: { promotions: true } })).toBe(
      'subscribe',
    )
  })

  it('lets a deletion beat every other state', () => {
    expect(
      audienceAction('all', {
        deleted: true,
        fromV1: true,
        prefs: { promotions: { email: true } },
      }),
    ).toBe('remove')
  })
})
