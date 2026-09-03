import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import { authId } from '../../lib/authId'
import type { Device } from '../push/devices'
import {
  campaignRecipients,
  claimCampaignRecipients,
  deriveTextBody,
  releaseCampaignRecipients,
  UNSUBSCRIBE_PLACEHOLDER,
} from './campaign'

const CAMPAIGN = '2026-09-launch'

describe('who a campaign may be sent to', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'campaign_test')
    await ensureIndexes(handle.db)
  })

  afterAll(async () => {
    await handle.close()
    await mongo.stop()
  })

  beforeEach(async () => {
    for (const name of [
      COLLECTIONS.profiles,
      COLLECTIONS.user,
      COLLECTIONS.devices,
      COLLECTIONS.emailCampaigns,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
  })

  async function newProfile(
    opts: {
      notifications?: unknown
      verified?: boolean
      email?: boolean
      deleted?: boolean
      locale?: string
    } = {},
  ): Promise<string> {
    const userId = new ObjectId().toHexString()
    await handle.db.collection(COLLECTIONS.profiles).insertOne({
      _id: userId,
      handle: `h${userId.slice(-12)}`,
      settings: { discoverable: true, notifications: opts.notifications ?? {} },
      ...(opts.deleted ? { deletedAt: new Date() } : {}),
    } as never)
    if (opts.email !== false) {
      await handle.db.collection(COLLECTIONS.user).insertOne({
        _id: authId(userId),
        email: `${userId}@example.com`,
        emailVerified: opts.verified ?? true,
      })
    }
    if (opts.locale) {
      await handle.db.collection<Device>(COLLECTIONS.devices).insertOne({
        userId,
        pushToken: `t-${userId}`,
        platform: 'ios',
        locale: opts.locale as never,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never)
    }
    return userId
  }

  const optedIn = { promotions: { push: false, email: true } }

  it('includes only people who said yes', async () => {
    const yes = await newProfile({ notifications: optedIn })
    await newProfile()
    await newProfile({ notifications: { promotions: { email: false } } })

    const audience = await campaignRecipients(handle.db, CAMPAIGN)
    expect(audience.recipients.map((r) => r.userId)).toEqual([yes])
    expect(audience.skipped.optedOut).toBe(2)
  })

  /**
   * The one cell that is never inferred. Every other kind falls back to a
   * default when nobody has said; consent to be marketed at has to be given.
   */
  it('never infers consent from an older stored shape', async () => {
    await newProfile({ notifications: true })
    await newProfile({ notifications: { promotions: true } })

    const audience = await campaignRecipients(handle.db, CAMPAIGN)
    expect(audience.recipients).toHaveLength(0)
  })

  it('excludes an unverified address and one that does not exist', async () => {
    await newProfile({ notifications: optedIn, verified: false })
    await newProfile({ notifications: optedIn, email: false })

    const audience = await campaignRecipients(handle.db, CAMPAIGN)
    expect(audience.recipients).toHaveLength(0)
    expect(audience.skipped).toMatchObject({ unverified: 1, noEmail: 1 })
  })

  it('excludes somebody on their way out', async () => {
    await newProfile({ notifications: optedIn, deleted: true })
    expect((await campaignRecipients(handle.db, CAMPAIGN)).recipients).toHaveLength(0)
  })

  it('excludes anybody this campaign already reached', async () => {
    const userId = await newProfile({ notifications: optedIn })
    await claimCampaignRecipients(handle.db, CAMPAIGN, [userId])

    const audience = await campaignRecipients(handle.db, CAMPAIGN)
    expect(audience.recipients).toHaveLength(0)
    expect(audience.skipped.alreadySent).toBe(1)
    // A different campaign is a different question.
    expect((await campaignRecipients(handle.db, 'other')).recipients).toHaveLength(1)
  })

  it('can be narrowed to one language', async () => {
    const turkish = await newProfile({ notifications: optedIn, locale: 'tr' })
    await newProfile({ notifications: optedIn, locale: 'de' })

    const audience = await campaignRecipients(handle.db, CAMPAIGN, { locale: 'tr' })
    expect(audience.recipients.map((r) => r.userId)).toEqual([turkish])
  })

  it('stops at a limit', async () => {
    for (let i = 0; i < 3; i++) await newProfile({ notifications: optedIn })
    expect((await campaignRecipients(handle.db, CAMPAIGN, { limit: 2 })).recipients).toHaveLength(2)
  })
})

describe('claiming a batch', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'campaign_claim_test')
    await ensureIndexes(handle.db)
  })

  afterAll(async () => {
    await handle.close()
    await mongo.stop()
  })

  beforeEach(async () => {
    await handle.db.collection(COLLECTIONS.emailCampaigns).deleteMany({})
  })

  it('claims everybody the first time', async () => {
    expect(await claimCampaignRecipients(handle.db, CAMPAIGN, ['a', 'b'])).toEqual(['a', 'b'])
  })

  /**
   * The whole safety story of a re-run after a crash: the unique index refuses
   * the second insert, so the second send cannot happen either.
   */
  it('claims only the newcomers when a batch overlaps', async () => {
    await claimCampaignRecipients(handle.db, CAMPAIGN, ['a'])
    const claimed = await claimCampaignRecipients(handle.db, CAMPAIGN, ['a', 'b', 'c'])

    expect(claimed.sort()).toEqual(['b', 'c'])
    expect(await handle.db.collection(COLLECTIONS.emailCampaigns).countDocuments({})).toBe(3)
  })

  /**
   * The first version read the claim back by `sentAt`, which is the same
   * millisecond for two batches on a fast machine — so the second call
   * reported having claimed people the first one had, and the script would
   * have mailed them twice. Pinning the timestamp is what makes that failure
   * deterministic rather than a matter of how quick the runner is.
   */
  it('does not claim somebody just because they share a timestamp', async () => {
    const sameInstant = new Date('2026-09-03T00:00:00.000Z')
    await claimCampaignRecipients(handle.db, CAMPAIGN, ['a'], sameInstant)
    const claimed = await claimCampaignRecipients(handle.db, CAMPAIGN, ['a', 'b'], sameInstant)

    expect(claimed).toEqual(['b'])
  })

  it('claims nobody when the whole batch was already sent', async () => {
    await claimCampaignRecipients(handle.db, CAMPAIGN, ['a', 'b'])
    expect(await claimCampaignRecipients(handle.db, CAMPAIGN, ['a', 'b'])).toEqual([])
  })

  it('gives them back when the send fails', async () => {
    const claimed = await claimCampaignRecipients(handle.db, CAMPAIGN, ['a', 'b'])
    await releaseCampaignRecipients(handle.db, CAMPAIGN, claimed)

    expect(await claimCampaignRecipients(handle.db, CAMPAIGN, ['a', 'b'])).toEqual(['a', 'b'])
  })
})

describe('the plain-text part of a campaign', () => {
  /**
   * The bug this exists for: the placeholder is written inside
   * `<a href="{{unsubscribeUrl}}">`, so stripping tags takes it away — and the
   * script then refused a campaign that was perfectly correct, every time.
   */
  it('keeps a way out even when the link was written as an anchor', () => {
    const text = deriveTextBody('<p>Hello</p><p><a href="{{unsubscribeUrl}}">Unsubscribe</a></p>')
    expect(text).toContain(UNSUBSCRIBE_PLACEHOLDER)
    expect(text).toContain('Hello')
  })

  it('does not repeat one that survived the strip', () => {
    const text = deriveTextBody('<p>Hello. Out: {{unsubscribeUrl}}</p>')
    expect(text.match(/\{\{unsubscribeUrl\}\}/g)).toHaveLength(1)
  })

  it('reads as text, not as markup', () => {
    expect(deriveTextBody('<p>One</p><p>Two {{unsubscribeUrl}}</p>')).not.toContain('<')
  })
})
