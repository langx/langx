import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'
import {
  LATE_RENEWAL_MS,
  acknowledgeProWelcome,
  becamePro,
  markProWelcome,
  welcomeFor,
  welcomeIfBecamePro,
  type EntitlementForEdge,
} from './proWelcome'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date()
const ahead = (ms: number) => new Date(NOW.getTime() + ms)
const ago = (ms: number) => new Date(NOW.getTime() - ms)

const FREE: EntitlementForEdge = { tier: 'free', willRenew: false }
const PAID: EntitlementForEdge = {
  tier: 'pro',
  expiresAt: ahead(30 * DAY),
  willRenew: true,
  store: 'app_store',
  periodType: 'normal',
}

describe('becamePro', () => {
  it('is the edge from free to Pro', () => {
    expect(becamePro(FREE, PAID, NOW)).toBe(true)
  })

  it('is not an edge when Pro already held — a renewal, a plan change', () => {
    expect(becamePro(PAID, PAID, NOW)).toBe(false)
    // The retired spelling is Pro too.
    expect(becamePro({ ...PAID, tier: 'pro_plus' }, PAID, NOW)).toBe(false)
  })

  it('is not an edge into free', () => {
    expect(becamePro(FREE, FREE, NOW)).toBe(false)
    expect(becamePro(PAID, FREE, NOW)).toBe(false)
  })

  it('is not an edge into an entitlement that has already ended', () => {
    expect(becamePro(FREE, { ...PAID, expiresAt: ago(DAY) }, NOW)).toBe(false)
  })

  it('counts a lapsed subscription whose expiry never arrived as free', () => {
    // Stored as Pro, cancelled, ended a year ago; the EXPIRATION was lost.
    const lapsed: EntitlementForEdge = { ...PAID, expiresAt: ago(365 * DAY), willRenew: false }
    expect(becamePro(lapsed, PAID, NOW)).toBe(true)
  })

  it('does not welcome a renewal recorded after the old period ended', () => {
    const due: EntitlementForEdge = { ...PAID, expiresAt: ago(2 * 60 * 60 * 1000) }
    expect(becamePro(due, PAID, NOW)).toBe(false)
  })

  it('welcomes a subscription that was going to renew but ended long ago', () => {
    const long: EntitlementForEdge = { ...PAID, expiresAt: ago(LATE_RENEWAL_MS + DAY) }
    expect(becamePro(long, PAID, NOW)).toBe(true)
  })

  it('welcomes nobody when there was no profile to write to', () => {
    expect(becamePro(null, PAID, NOW)).toBe(false)
  })

  it('treats a lifetime grant, which has no end, as Pro', () => {
    const lifetime: EntitlementForEdge = { tier: 'pro', willRenew: false, store: 'promotional' }
    expect(becamePro(FREE, lifetime, NOW)).toBe(true)
    expect(becamePro(lifetime, PAID, NOW)).toBe(false)
  })
})

describe('the Pro welcome, stored', () => {
  let server: MongoMemoryServer
  let handle: DbHandle

  beforeAll(async () => {
    server = await MongoMemoryServer.create()
    handle = await connectToDatabase(server.getUri(), 'langx_pro_welcome_test')
  }, 60_000)

  afterAll(async () => {
    await handle?.close()
    await server?.stop()
  })

  const profiles = () => handle.db.collection<Profile>(COLLECTIONS.profiles)

  async function seed(id: string, entitlement: Profile['entitlement']): Promise<void> {
    await profiles().insertOne({ _id: id, entitlement } as unknown as Profile)
  }

  describe('welcomeFor', () => {
    it('names a paid period a purchase', async () => {
      expect(await welcomeFor(handle.db, 'x', PAID)).toEqual({ source: 'purchase' })
      expect(await welcomeFor(handle.db, 'x', { ...PAID, periodType: 'intro' })).toEqual({
        source: 'purchase',
      })
      // Absent means "not known", and a store purchase is still a purchase.
      expect(await welcomeFor(handle.db, 'x', { ...PAID, periodType: null })).toEqual({
        source: 'purchase',
      })
    })

    it('names a free week a trial', async () => {
      expect(await welcomeFor(handle.db, 'x', { ...PAID, periodType: 'trial' })).toEqual({
        source: 'trial',
      })
    })

    it('names a grant a gift, however the store is spelled', async () => {
      for (const store of ['gift', 'promotional', 'PROMOTIONAL']) {
        // A grant carries no period, but a webhook may still say "trial" for
        // it; the store decides first.
        expect(await welcomeFor(handle.db, 'x', { ...PAID, store, periodType: 'trial' })).toEqual({
          source: 'gift',
        })
      }
    })
  })

  it('leaves a welcome on the edge and none on the write after it', async () => {
    await seed('edge-user', { tier: 'free', updatedAt: NOW })

    expect(await welcomeIfBecamePro(handle.db, 'edge-user', FREE, PAID, NOW)).toBe(true)
    const first = (await profiles().findOne({ _id: 'edge-user' }))?.proWelcome
    expect(first).toEqual({ at: NOW, source: 'purchase' })

    expect(await welcomeIfBecamePro(handle.db, 'edge-user', PAID, PAID, ahead(1000))).toBe(false)
    expect((await profiles().findOne({ _id: 'edge-user' }))?.proWelcome).toEqual(first)
  })

  it('keeps the months of a fixed-length grant', async () => {
    await seed('months-user', { tier: 'pro', updatedAt: NOW })
    await markProWelcome(handle.db, 'months-user', { source: 'streak', months: 3 }, NOW)
    expect((await profiles().findOne({ _id: 'months-user' }))?.proWelcome).toEqual({
      at: NOW,
      source: 'streak',
      months: 3,
    })
  })

  it('clears the welcome that was shown, and only that one', async () => {
    await seed('ack-user', { tier: 'pro', updatedAt: NOW })
    const shown = ago(60_000)
    await markProWelcome(handle.db, 'ack-user', { source: 'purchase' }, shown)
    // A gift lands while the purchase welcome is on screen.
    await markProWelcome(handle.db, 'ack-user', { source: 'gift', months: 1 }, NOW)

    expect(await acknowledgeProWelcome(handle.db, 'ack-user', shown)).toBe(false)
    expect((await profiles().findOne({ _id: 'ack-user' }))?.proWelcome?.source).toBe('gift')

    expect(await acknowledgeProWelcome(handle.db, 'ack-user', NOW)).toBe(true)
    expect((await profiles().findOne({ _id: 'ack-user' }))?.proWelcome).toBeUndefined()

    // A second device dismissing the same welcome finds nothing to clear.
    expect(await acknowledgeProWelcome(handle.db, 'ack-user', NOW)).toBe(false)
  })
})
