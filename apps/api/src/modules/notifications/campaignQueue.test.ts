import { CAMPAIGN_WARMUP_PER_DAY } from '@langx/shared'
import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import type { NotificationEmailContext } from '../../email/notify'
import { verifyUnsubscribeToken } from '../../email/unsubscribeToken'
import { authId } from '../../lib/authId'
import { CapturingEmailSender } from '../../testSupport/authFlow'
import { claimCampaignRecipients } from './campaign'
import {
  enqueueCampaign,
  personalise,
  resolveCampaignAudience,
  runCampaignQueuePass,
  setCampaignStatus,
  type QueuedCampaign,
} from './campaignQueue'
import { suppressEmail } from './suppressions'

const SECRET = 'q'.repeat(40)
const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
/** Inside the UTC window, with plenty of ticks left in the day. */
const MORNING = new Date('2026-09-14T09:00:00Z')
const NIGHT = new Date('2026-09-14T23:00:00Z')

const HTML =
  '<p>Hi {{firstName}}</p><a href="https://app.langx.io/sign-in-link?email={{email}}">in</a><a href="{{unsubscribeUrl}}">out</a>'
const TEXT =
  'Hi {{firstName}}\nin: https://app.langx.io/sign-in-link?email={{email}}\nout: {{unsubscribeUrl}}'

describe('the campaign queue', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle
  let sender: CapturingEmailSender
  let ctx: NotificationEmailContext

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'campaign_queue_test')
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
      COLLECTIONS.emailCampaigns,
      COLLECTIONS.campaignQueue,
      COLLECTIONS.emailSuppressions,
      COLLECTIONS.notificationLedger,
      COLLECTIONS.jobRuns,
      COLLECTIONS.v1DeletedContacts,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
    sender = new CapturingEmailSender()
    ctx = { sender, unsubscribeSecret: SECRET, apiBaseUrl: 'https://api.langx.io' }
  })

  /** A verified account; `profile: false` leaves it as a bare v1-style row. */
  async function newAccount(
    opts: { profile?: boolean; fromV1?: boolean; name?: string; optedIn?: boolean } = {},
  ): Promise<string> {
    const userId = new ObjectId().toHexString()
    if (opts.profile !== false) {
      await handle.db.collection(COLLECTIONS.profiles).insertOne({
        _id: userId,
        handle: `h${userId.slice(-12)}`,
        displayName: opts.name ?? 'Sofia R.',
        settings: {
          discoverable: true,
          notifications: opts.optedIn === false ? {} : { promotions: { push: false, email: true } },
        },
        nativeLanguages: [{ code: 'tr' }],
      } as never)
    }
    await handle.db.collection(COLLECTIONS.user).insertOne({
      _id: authId(userId),
      email: `${userId}@example.com`,
      name: opts.name ?? 'Sofia',
      emailVerified: true,
      ...(opts.fromV1 ? { precreatedFromV1: { at: new Date(), legacyUserId: 'v1id' } } : {}),
    })
    return userId
  }

  async function queued(overrides: Partial<QueuedCampaign> = {}): Promise<string> {
    const id = overrides._id ?? `c-${Math.random().toString(36).slice(2, 8)}`
    await enqueueCampaign(handle.db, {
      _id: id,
      subject: 'hello',
      html: HTML,
      text: TEXT,
      source: 'consented',
      excludeReturned: false,
      ignoreCap: false,
      total: 0,
      ...overrides,
    })
    return id
  }

  it('refuses a body with no way out', async () => {
    await expect(queued({ html: '<p>no link</p>' })).rejects.toThrow('{{unsubscribeUrl}}')
  })

  it('refuses the same campaign id twice', async () => {
    await queued({ _id: 'twice' })
    await expect(queued({ _id: 'twice' })).rejects.toThrow('already queued')
  })

  it('sends nothing outside the UTC window, and does not start the clock', async () => {
    await newAccount()
    const id = await queued()
    expect(await runCampaignQueuePass(handle.db, ctx, NIGHT)).toEqual({ sent: 0 })
    expect(sender.messages).toHaveLength(0)
    const row = await handle.db
      .collection<QueuedCampaign>(COLLECTIONS.campaignQueue)
      .findOne({ _id: id })
    expect(row?.status).toBe('queued')
    expect(row?.startedAt).toBeUndefined()
  })

  it('sends inside the window, personalises, and signs the unsubscribe for that person', async () => {
    const userId = await newAccount({ name: 'Sofia R.' })
    const id = await queued()

    expect(await runCampaignQueuePass(handle.db, ctx, MORNING)).toEqual({ sent: 1 })
    const message = sender.messages[0]
    expect(message?.to).toBe(`${userId}@example.com`)
    expect(message?.html).toContain('Hi Sofia R.')
    expect(message?.html).toContain(
      `sign-in-link?email=${encodeURIComponent(`${userId}@example.com`)}`,
    )
    expect(message?.html).not.toContain('{{')
    expect(message?.text).not.toContain('{{')
    const token = new URL(message!.headers!['List-Unsubscribe']!.slice(1, -1)).searchParams.get(
      'token',
    )
    expect(verifyUnsubscribeToken(SECRET, token ?? undefined)).toEqual({
      userId,
      scope: 'promotions',
    })

    const row = await handle.db
      .collection<QueuedCampaign>(COLLECTIONS.campaignQueue)
      .findOne({ _id: id })
    expect(row).toMatchObject({ status: 'sending', sent: 1, startedAt: MORNING })
  })

  /** "Reply to this email — it reaches a human" has to be true from a no-reply@ sender. */
  it('carries the Reply-To the context names', async () => {
    await newAccount()
    await queued()
    await runCampaignQueuePass(handle.db, { ...ctx, replyTo: 'hi@langx.io' }, MORNING)
    expect(sender.messages[0]?.replyTo).toBe('hi@langx.io')
  })

  it('never mails the same person twice, and finishes when nobody is left', async () => {
    await newAccount()
    const id = await queued()
    await runCampaignQueuePass(handle.db, ctx, MORNING)
    // A later tick of the same day: everyone is claimed.
    const later = new Date(MORNING.getTime() + HOUR)
    expect(await runCampaignQueuePass(handle.db, ctx, later)).toEqual({ sent: 0 })
    expect(sender.messages).toHaveLength(1)
    const row = await handle.db
      .collection<QueuedCampaign>(COLLECTIONS.campaignQueue)
      .findOne({ _id: id })
    expect(row?.status).toBe('done')
    expect(row?.finishedAt).toEqual(later)
  })

  /**
   * Two machines tick at once. Only the one that inserted the tick's `jobRuns`
   * row sends; the claim would have stopped double mail anyway, but the lock
   * keeps the pace to one share per tick rather than two.
   */
  it('lets one instance per tick send', async () => {
    await newAccount()
    await newAccount()
    await queued()
    const [first, second] = await Promise.all([
      runCampaignQueuePass(handle.db, ctx, MORNING),
      runCampaignQueuePass(handle.db, ctx, MORNING),
    ])
    expect([first.sent, second.sent].sort()).toEqual([0, 2])
  })

  it("spreads the day's budget over the ticks left in the window", async () => {
    // More people than the first day's budget allows in one tick.
    for (let index = 0; index < 30; index++) await newAccount()
    await queued()
    // 09:00 → 22 half-hour ticks left until 20:00; 250 / 22 = 12 per tick.
    const firstDayBudget = CAMPAIGN_WARMUP_PER_DAY[0]
    const perTick = Math.ceil(firstDayBudget / 22)
    expect(await runCampaignQueuePass(handle.db, ctx, MORNING)).toEqual({ sent: perTick })
    // The next tick sees what is already sent today and keeps the same pace.
    const next = new Date(MORNING.getTime() + 30 * 60 * 1000)
    expect(await runCampaignQueuePass(handle.db, ctx, next)).toEqual({
      sent: Math.ceil((firstDayBudget - perTick) / 21),
    })
  })

  it('stops for the day once the budget is spent, and grows it tomorrow', async () => {
    for (let index = 0; index < 5; index++) await newAccount()
    const id = await queued()
    await runCampaignQueuePass(handle.db, ctx, MORNING)
    // Pretend the whole first-day budget already went out today.
    const filler = Array.from({ length: CAMPAIGN_WARMUP_PER_DAY[0] }, (_, i) => `filler-${i}`)
    await claimCampaignRecipients(handle.db, id, filler, new Date(MORNING.getTime() + 60_000))
    sender.messages.length = 0

    expect(await runCampaignQueuePass(handle.db, ctx, new Date(MORNING.getTime() + HOUR))).toEqual({
      sent: 0,
    })
    // Tomorrow is day 1 of the ramp, with a fresh budget — and four people
    // who signed up overnight.
    for (let index = 0; index < 4; index++) await newAccount()
    expect(await runCampaignQueuePass(handle.db, ctx, new Date(MORNING.getTime() + DAY))).toEqual({
      sent: 4,
    })
  })

  it('pauses and resumes where the claims left off', async () => {
    await newAccount()
    await newAccount()
    const id = await queued()
    expect(await setCampaignStatus(handle.db, id, 'paused')).toBe(true)
    expect(await runCampaignQueuePass(handle.db, ctx, MORNING)).toEqual({ sent: 0 })
    expect(await setCampaignStatus(handle.db, id, 'queued')).toBe(true)
    expect(await runCampaignQueuePass(handle.db, ctx, MORNING)).toEqual({ sent: 2 })
  })

  it('releases a batch the sender refused, so the next tick retries it', async () => {
    await newAccount()
    const id = await queued()
    const failing: NotificationEmailContext = {
      ...ctx,
      sender: {
        deliverable: true,
        send: () => Promise.reject(new Error('resend down')),
      },
    }
    expect(await runCampaignQueuePass(handle.db, failing, MORNING)).toEqual({ sent: 0, failed: 1 })
    expect(
      await handle.db.collection(COLLECTIONS.emailCampaigns).countDocuments({ campaignId: id }),
    ).toBe(0)
    expect(await runCampaignQueuePass(handle.db, ctx, new Date(MORNING.getTime() + HOUR))).toEqual({
      sent: 1,
    })
  })

  describe('who a source reaches', () => {
    it('v1: pre-created rows with no profile, greeted by the name the row carries', async () => {
      const bare = await newAccount({ profile: false, fromV1: true, name: 'Behlül' })
      await newAccount({ profile: false }) // never v1, nobody said yes
      const audience = await resolveCampaignAudience(handle.db, {
        _id: 'x',
        source: 'v1',
        excludeReturned: false,
        ignoreCap: false,
      })
      expect(audience.targets).toEqual([
        {
          id: bare,
          email: `${bare}@example.com`,
          locale: 'en',
          firstName: 'Behlül',
          scope: 'promotions',
        },
      ])
    })

    it('excludes anybody who has since onboarded when asked to', async () => {
      const bare = await newAccount({ profile: false, fromV1: true })
      await newAccount({ fromV1: true })
      const audience = await resolveCampaignAudience(handle.db, {
        _id: 'x',
        source: 'v1',
        excludeReturned: true,
        ignoreCap: false,
      })
      expect(audience.targets.map((t) => t.id)).toEqual([bare])
      expect(audience.skipped.returned).toBe(1)
    })

    it('v1deleted: the contacts collection, under the scope that forgets the address', async () => {
      await handle.db.collection(COLLECTIONS.v1DeletedContacts).insertMany([
        {
          _id: 'appwrite-1',
          email: 'One@Example.com',
          name: 'One',
          legacyUserId: 'appwrite-1',
          recordedAt: new Date(),
        },
        {
          _id: 'appwrite-2',
          email: 'two@example.com',
          name: 'Two',
          legacyUserId: 'appwrite-2',
          recordedAt: new Date(),
        },
      ] as never[])
      await suppressEmail(handle.db, { email: 'two@example.com', reason: 'unsubscribed' })
      const audience = await resolveCampaignAudience(handle.db, {
        _id: 'x',
        source: 'v1deleted',
        excludeReturned: false,
        ignoreCap: false,
      })
      expect(audience.targets).toEqual([
        {
          id: 'appwrite-1',
          email: 'One@Example.com',
          locale: 'en',
          firstName: 'One',
          scope: 'v1contact',
        },
      ])
      expect(audience.skipped.suppressed).toBe(1)
    })

    it('defers, rather than skips, somebody inside the marketing gap', async () => {
      const userId = await newAccount()
      await claimCampaignRecipients(
        handle.db,
        'earlier',
        [userId],
        new Date(MORNING.getTime() - 2 * DAY),
      )
      const capped = await resolveCampaignAudience(
        handle.db,
        { _id: 'x', source: 'consented', excludeReturned: false, ignoreCap: false },
        { now: MORNING },
      )
      expect(capped.targets).toHaveLength(0)
      expect(capped.skipped.capped).toBe(1)

      const eightDaysOn = new Date(MORNING.getTime() + 8 * DAY)
      const free = await resolveCampaignAudience(
        handle.db,
        { _id: 'x', source: 'consented', excludeReturned: false, ignoreCap: false },
        { now: eightDaysOn },
      )
      expect(free.targets).toHaveLength(1)

      const forced = await resolveCampaignAudience(
        handle.db,
        { _id: 'x', source: 'consented', excludeReturned: false, ignoreCap: true },
        { now: MORNING },
      )
      expect(forced.targets).toHaveLength(1)
    })

    it('does not finish a campaign whose only remaining people are deferred', async () => {
      const userId = await newAccount()
      await claimCampaignRecipients(
        handle.db,
        'earlier',
        [userId],
        new Date(MORNING.getTime() - DAY),
      )
      const id = await queued()
      await runCampaignQueuePass(handle.db, ctx, MORNING)
      const row = await handle.db
        .collection<QueuedCampaign>(COLLECTIONS.campaignQueue)
        .findOne({ _id: id })
      expect(row?.status).toBe('sending')
      expect(
        await runCampaignQueuePass(handle.db, ctx, new Date(MORNING.getTime() + 8 * DAY)),
      ).toEqual({ sent: 1 })
    })
  })

  it('falls back to "there" for a body that greets somebody we cannot name', () => {
    expect(personalise('Hi {{firstName}} {{unsubscribeUrl}}', { email: 'a@b.c' }, 'U')).toBe(
      'Hi there U',
    )
    expect(personalise('Hi {{firstName}}', { email: 'a@b.c', firstName: '  ' }, 'U')).toBe(
      'Hi there',
    )
  })
})
