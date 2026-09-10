import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import { authId } from '../../lib/authId'
import { DEFAULT_NOTIFICATION_PREFS } from '@langx/shared'
import { audienceAction, audiencePlan } from './audience'
import { suppressEmail } from './suppressions'

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
    for (const name of [COLLECTIONS.profiles, COLLECTIONS.user, COLLECTIONS.emailSuppressions]) {
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

  /**
   * Since the reversal, "consented" is everybody the default put on the list
   * as well as everybody who chose it — the `notificationsAllowed` answer,
   * which is the only definition a sender uses.
   */
  it('takes everybody the reader says may be mailed', async () => {
    const yes = await newAccount({ notifications: optedIn })
    const unanswered = await newAccount()
    const fromV1 = await newAccount({ fromV1: true })

    const plan = await audiencePlan(handle.db, 'consented')
    expect(new Set(plan.contacts.map((contact) => contact.userId))).toEqual(
      new Set([yes, unanswered, fromV1]),
    )
    expect(plan.skipped.noConsent).toBe(0)
  })

  /**
   * The sources have converged since the reversal: an unanswered account is
   * on the list under all three, because the default put it there. What
   * `--source v1` still buys is the pre-created rows that have no profile at
   * all — see the case further down.
   */
  it('takes an unanswered account under consented and all', async () => {
    const yes = await newAccount({ notifications: optedIn })
    const v1 = await newAccount({ fromV1: true })
    const neither = await newAccount()

    const plan = await audiencePlan(handle.db, 'all')
    expect(new Set(plan.contacts.map((contact) => contact.userId))).toEqual(
      new Set([yes, v1, neither]),
    )
  })

  /**
   * `--source v1` names a population, not a consent, and the difference
   * stopped being free when promotional email became opt-out: without it, a
   * campaign asking for v1 accounts is handed every verified address there
   * is — which for the launch letter means telling somebody who signed up
   * last week that their streak is waiting.
   */
  it('takes only accounts that actually came from v1 under the v1 source', async () => {
    const v1 = await newAccount({ fromV1: true })
    await newAccount({ notifications: optedIn })
    await newAccount()

    const plan = await audiencePlan(handle.db, 'v1')
    expect(plan.contacts.map((contact) => contact.userId)).toEqual([v1])
    expect(plan.skipped.noConsent).toBe(2)
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
        // The refusal itself. Since the default opts in, this cell has to be
        // off explicitly to mean no — which is exactly what the settings
        // screen writes when somebody turns the row off.
        promotions: { push: false, email: false },
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

  it('sends a suppressed address up as unsubscribed, never as a subscriber', async () => {
    const bounced = await newAccount({ notifications: optedIn, email: 'Bounced@Example.com' })
    await suppressEmail(handle.db, { email: 'bounced@example.com', reason: 'bounced' })

    const plan = await audiencePlan(handle.db, 'all')
    expect(plan.contacts.find((c) => c.userId === bounced)?.action).toBe('unsubscribe')
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

  /**
   * The bare boolean says nothing about mail — but the default it falls
   * through to now says yes, so the answer is `subscribe` for a reason that
   * has nothing to do with what v1 wrote.
   */
  it('lets the default answer for a shape that could not', () => {
    expect(audienceAction('consented', { ...account, prefs: { promotions: true } })).toBe(
      'subscribe',
    )
    expect(audienceAction('consented', { ...account, prefs: { promotions: false } })).toBe(
      'unsubscribe',
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
