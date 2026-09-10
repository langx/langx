import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import { claimCampaignRecipients } from './campaign'
import { claimOnce } from './ledger'
import { recentlyMarketed } from './marketing'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-09-14T12:00:00Z')

describe('the marketing frequency cap', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'marketing_test')
    await ensureIndexes(handle.db)
  })

  afterAll(async () => {
    await handle.close()
    await mongo.stop()
  })

  beforeEach(async () => {
    for (const name of [COLLECTIONS.emailCampaigns, COLLECTIONS.notificationLedger]) {
      await handle.db.collection(name).deleteMany({})
    }
  })

  it('counts a campaign inside the gap, and forgets one outside it', async () => {
    await claimCampaignRecipients(handle.db, 'launch', ['u1'], new Date(NOW.getTime() - 3 * DAY))
    await claimCampaignRecipients(handle.db, 'launch', ['u2'], new Date(NOW.getTime() - 10 * DAY))
    expect(await recentlyMarketed(handle.db, 'u1', NOW)).toBe(true)
    expect(await recentlyMarketed(handle.db, 'u2', NOW)).toBe(false)
    expect(await recentlyMarketed(handle.db, 'u3', NOW)).toBe(false)
  })

  /** The passes claim under `promo.<job>`; a service pass under any other name is not marketing. */
  it('counts a promotional pass, and only a promotional one', async () => {
    await claimOnce(handle.db, 'promo.photo', 'u1', 'once')
    await claimOnce(handle.db, 'unreadDigest', 'u2', '2026-09-14')
    expect(await recentlyMarketed(handle.db, 'u1', NOW)).toBe(true)
    expect(await recentlyMarketed(handle.db, 'u2', NOW)).toBe(false)
    // A user id that is a prefix of another must not match the other.
    expect(await recentlyMarketed(handle.db, 'u', NOW)).toBe(false)
  })
})
