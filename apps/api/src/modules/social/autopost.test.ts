import { SOCIAL_AUTOPOST_RULES, type SocialPlatform } from '@langx/shared'
import { ObjectId, type Db } from 'mongodb'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import { invalidateAppConfigCache, setAppConfigFlag } from '../appConfig/appConfig'
import type { SocialAdapters } from './adapters'
import { runSocialAutopostTick } from './autopost'
import {
  applySocialPostAction,
  approveSocialPosts,
  importSocialSlots,
  nextSocialPosts,
  useSocialAlternate,
  type SocialPost,
  type SocialPostSlot,
} from './posts'
import { SocialPublishError, type SocialAdapter, type SocialPublishInput } from './publish'

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
/** The first slot's time; every test's clock is read against it. */
const T0 = new Date('2026-11-02T17:30:00.000Z')

const silent = { error: () => {} }

function slot(
  dayOffset: number,
  platform: SocialPlatform,
  overrides: Partial<SocialPostSlot> = {},
) {
  const day = String(dayOffset + 1).padStart(3, '0')
  return {
    calendarVersion: 1,
    dayOffset,
    platform,
    videoDay: dayOffset + 1,
    lang: 'en',
    videoUrl: `https://media.langx.io/venus/v1/en/venus-day${day}-en.mp4`,
    coverUrl: `https://media.langx.io/venus/v1/en/venus-day${day}-en.jpg`,
    scheduledAt: new Date(T0.getTime() + dayOffset * 24 * HOUR),
    content: { caption: `Day ${dayOffset + 1}.`, hashtags: ['#LangXVenus'] },
    firstComment: null,
    nativeCheck: null,
    alternate: null,
    ...overrides,
  } satisfies SocialPostSlot
}

/** An adapter that records what it was asked and answers from `answer`. */
function recorder(
  platform: SocialPlatform,
  answer: (input: SocialPublishInput, call: number) => Promise<{ id: string; url: string | null }>,
) {
  const calls: SocialPublishInput[] = []
  const adapter: SocialAdapter = {
    platform,
    publish: (input) => {
      calls.push(input)
      return answer(input, calls.length)
    },
  }
  return { adapter, calls }
}

const ok = (id: string) => () => Promise.resolve({ id, url: `https://example.com/${id}` })

describe('social auto-posting', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle
  let db: Db

  const rows = () => db.collection<SocialPost>(COLLECTIONS.socialPosts)
  const row = async (dayOffset: number, platform: SocialPlatform) => {
    const found = await rows().findOne({ calendarVersion: 1, dayOffset, platform })
    if (!found) throw new Error(`no row ${dayOffset}/${platform}`)
    return found
  }

  async function switchOn(on = true): Promise<void> {
    await setAppConfigFlag(db, 'socialAutopost', on)
  }

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_social_autopost_test')
    db = handle.db
    await ensureIndexes(db)
  })

  afterAll(async () => {
    await handle?.close()
    await replSet?.stop()
  })

  beforeEach(async () => {
    await rows().deleteMany({})
    await db.collection(COLLECTIONS.appConfig).deleteMany({})
    invalidateAppConfigCache()
  })

  describe('the import', () => {
    it('writes drafts, and is a no-op the second time', async () => {
      const calendar = [slot(0, 'instagram'), slot(0, 'tiktok'), slot(1, 'instagram')]
      expect(await importSocialSlots(db, calendar, T0)).toEqual({
        inserted: 3,
        updated: 0,
        unapproved: 0,
        kept: 0,
      })
      const again = await importSocialSlots(db, calendar, T0)
      expect(again.inserted).toBe(0)
      expect(await rows().countDocuments()).toBe(3)
      expect((await row(0, 'instagram')).status).toBe('draft')
    })

    it('makes a second row for one slot and platform physically impossible', async () => {
      await importSocialSlots(db, [slot(0, 'instagram')], T0)
      const existing = await row(0, 'instagram')
      await expect(rows().insertOne({ ...existing, _id: new ObjectId() })).rejects.toThrow(
        /duplicate key/i,
      )
    })

    it('puts an approved row the file changed back to draft, and keeps one it did not', async () => {
      await importSocialSlots(db, [slot(0, 'instagram'), slot(1, 'instagram')], T0)
      await approveSocialPosts(db, { calendarVersion: 1 }, 'behic', T0)

      const edited = slot(0, 'instagram', { content: { caption: 'New words.', hashtags: [] } })
      const result = await importSocialSlots(db, [edited, slot(1, 'instagram')], T0)

      expect(result).toMatchObject({ unapproved: 1, kept: 1 })
      expect((await row(0, 'instagram')).status).toBe('draft')
      expect((await row(0, 'instagram')).content.caption).toBe('New words.')
      expect((await row(1, 'instagram')).status).toBe('approved')
    })

    it('leaves a row that already went out alone', async () => {
      await importSocialSlots(db, [slot(0, 'instagram')], T0)
      await rows().updateOne({}, { $set: { status: 'published' } })
      const result = await importSocialSlots(
        db,
        [slot(0, 'instagram', { content: { caption: 'Changed.', hashtags: [] } })],
        T0,
      )
      expect(result.kept).toBe(1)
      expect((await row(0, 'instagram')).content.caption).toBe('Day 1.')
    })
  })

  describe('approval', () => {
    it('passes by a swap that waits for a native check, until its day is named', async () => {
      await importSocialSlots(
        db,
        [slot(0, 'instagram'), slot(5, 'instagram', { lang: 'tr', nativeCheck: 'needed' })],
        T0,
      )
      const bulk = await approveSocialPosts(db, { calendarVersion: 1 }, 'behic', T0)
      expect(bulk).toEqual({ approved: 1, heldForNativeCheck: [5] })
      expect((await row(5, 'instagram')).status).toBe('draft')

      const named = await approveSocialPosts(db, { calendarVersion: 1, dayOffset: 5 }, 'behic', T0)
      expect(named.approved).toBe(1)
      expect((await row(5, 'instagram')).status).toBe('approved')
    })

    it('swaps a declined language day for its English alternate', async () => {
      const at = new Date(T0.getTime() + 5 * 24 * HOUR)
      await importSocialSlots(
        db,
        [
          slot(5, 'instagram', {
            lang: 'tr',
            nativeCheck: 'needed',
            alternate: {
              lang: 'en',
              videoUrl: 'https://media.langx.io/venus/v1/en/venus-day006-en.mp4',
              coverUrl: 'https://media.langx.io/venus/v1/en/venus-day006-en.jpg',
              scheduledAt: at,
              content: { caption: 'Day 6. The speech.', hashtags: [] },
              firstComment: null,
            },
          }),
        ],
        T0,
      )
      expect(await useSocialAlternate(db, { calendarVersion: 1, dayOffset: 5 }, T0)).toBe(1)
      const swapped = await row(5, 'instagram')
      expect(swapped).toMatchObject({ lang: 'en', nativeCheck: null, alternate: null })
      expect(swapped.videoUrl).toContain('venus-day006-en.mp4')
      // An English day needs no native check, so a bulk approve now takes it.
      expect((await approveSocialPosts(db, { calendarVersion: 1 }, 'behic', T0)).approved).toBe(1)
    })
  })

  describe('the scheduler', () => {
    async function approvedDay0(platforms: SocialPlatform[] = ['instagram']): Promise<void> {
      await importSocialSlots(
        db,
        platforms.map((platform) => slot(0, platform)),
        T0,
      )
      await approveSocialPosts(db, { calendarVersion: 1 }, 'behic', T0)
    }

    it('does nothing at all while the switch is off', async () => {
      await approvedDay0()
      const instagram = recorder('instagram', ok('media-1'))
      const result = await runSocialAutopostTick(db, { instagram: instagram.adapter }, silent, T0)
      expect(result.off).toBe(true)
      expect(instagram.calls).toHaveLength(0)
      expect((await row(0, 'instagram')).status).toBe('approved')
    })

    it('posts an approved row at its time, and records what came back', async () => {
      await approvedDay0()
      await switchOn()
      const instagram = recorder('instagram', ok('media-1'))
      const adapters = { instagram: instagram.adapter }

      expect(
        (await runSocialAutopostTick(db, adapters, silent, new Date(T0.getTime() - MINUTE)))
          .published,
      ).toBe(0)
      const result = await runSocialAutopostTick(db, adapters, silent, T0)

      expect(result).toEqual({ published: 1, failed: 0, retrying: 0 })
      expect(instagram.calls[0]?.videoUrl).toContain('venus-day001-en.mp4')
      expect(await row(0, 'instagram')).toMatchObject({
        status: 'published',
        platformPostId: 'media-1',
        platformUrl: 'https://example.com/media-1',
        attempts: 1,
      })
    })

    it('never posts a draft', async () => {
      await importSocialSlots(db, [slot(0, 'instagram')], T0)
      await switchOn()
      const instagram = recorder('instagram', ok('media-1'))
      await runSocialAutopostTick(db, { instagram: instagram.adapter }, silent, T0)
      expect(instagram.calls).toHaveLength(0)
    })

    it('posts a row once when two passes run at the same moment', async () => {
      await approvedDay0()
      await switchOn()
      // Slow enough that both passes are inside it at once.
      const instagram = recorder(
        'instagram',
        () => new Promise((resolve) => setTimeout(() => resolve({ id: 'media-1', url: null }), 50)),
      )
      const adapters = { instagram: instagram.adapter }
      await Promise.all([
        runSocialAutopostTick(db, adapters, silent, T0),
        runSocialAutopostTick(db, adapters, silent, T0),
      ])
      expect(instagram.calls).toHaveLength(1)
    })

    it('retries a failure that posted nothing after a wait, and gives up after the last attempt', async () => {
      await approvedDay0()
      await switchOn()
      const instagram = recorder('instagram', () =>
        Promise.reject(new SocialPublishError('instagram container: 500', true)),
      )
      const adapters: SocialAdapters = { instagram: instagram.adapter }

      let now = T0
      for (let attempt = 1; attempt < SOCIAL_AUTOPOST_RULES.maxAttempts; attempt++) {
        expect((await runSocialAutopostTick(db, adapters, silent, now)).retrying).toBe(1)
        const waiting = await row(0, 'instagram')
        expect(waiting.status).toBe('approved')
        const wait = SOCIAL_AUTOPOST_RULES.backoffMinutes[attempt - 1] ?? 0
        // The wait runs from the failure, which a pass's own clock puts a
        // few milliseconds after the pass began.
        const after = waiting.dueAt.getTime() - (now.getTime() + wait * MINUTE)
        expect(after).toBeGreaterThanOrEqual(0)
        expect(after).toBeLessThan(1000)
        // Not before its time.
        await runSocialAutopostTick(db, adapters, silent, new Date(waiting.dueAt.getTime() - 1000))
        expect(instagram.calls).toHaveLength(attempt)
        now = waiting.dueAt
      }
      expect((await runSocialAutopostTick(db, adapters, silent, now)).failed).toBe(1)
      expect(await row(0, 'instagram')).toMatchObject({
        status: 'failed',
        attempts: SOCIAL_AUTOPOST_RULES.maxAttempts,
        lastError: 'instagram container: 500',
      })
      expect(instagram.calls).toHaveLength(SOCIAL_AUTOPOST_RULES.maxAttempts)
    })

    it('fails at once, without a retry, when the post may have gone out', async () => {
      await approvedDay0()
      await switchOn()
      const instagram = recorder('instagram', () =>
        Promise.reject(
          new SocialPublishError('instagram publish: timeout — it may have posted', false),
        ),
      )
      expect(
        (await runSocialAutopostTick(db, { instagram: instagram.adapter }, silent, T0)).failed,
      ).toBe(1)
      expect((await row(0, 'instagram')).status).toBe('failed')
    })

    it('treats an error no adapter shaped as one that may have posted', async () => {
      await approvedDay0()
      await switchOn()
      const instagram = recorder('instagram', () =>
        Promise.reject(new TypeError('undefined is not a function')),
      )
      await runSocialAutopostTick(db, { instagram: instagram.adapter }, silent, T0)
      expect((await row(0, 'instagram')).status).toBe('failed')
    })

    it('fails a row too late to post, rather than posting yesterday today', async () => {
      await approvedDay0()
      await switchOn()
      const instagram = recorder('instagram', ok('media-1'))
      const late = new Date(T0.getTime() + SOCIAL_AUTOPOST_RULES.maxLateMinutes * MINUTE + MINUTE)
      expect(
        (await runSocialAutopostTick(db, { instagram: instagram.adapter }, silent, late)).failed,
      ).toBe(1)
      expect(instagram.calls).toHaveLength(0)
      expect((await row(0, 'instagram')).lastError).toMatch(/^Missed/)
    })

    it('fails a platform with no credentials by name, and posts the others', async () => {
      await approvedDay0(['instagram', 'youtube'])
      await switchOn()
      const instagram = recorder('instagram', ok('media-1'))
      const result = await runSocialAutopostTick(db, { instagram: instagram.adapter }, silent, T0)
      expect(result).toEqual({ published: 1, failed: 1, retrying: 0 })
      expect((await row(0, 'youtube')).lastError).toContain('YOUTUBE_REFRESH_TOKEN')
    })

    it('fails a claim that died mid-post instead of posting it again', async () => {
      await approvedDay0()
      await switchOn()
      await rows().updateOne({}, { $set: { status: 'publishing', claimedAt: T0, attempts: 1 } })
      const instagram = recorder('instagram', ok('media-1'))
      const later = new Date(
        T0.getTime() + SOCIAL_AUTOPOST_RULES.staleClaimMinutes * MINUTE + MINUTE,
      )

      await runSocialAutopostTick(db, { instagram: instagram.adapter }, silent, later)

      expect(instagram.calls).toHaveLength(0)
      expect((await row(0, 'instagram')).status).toBe('failed')
      expect((await row(0, 'instagram')).lastError).toContain('check the account')
    })

    it('posts a failed row again when the operator retries it, even past its window', async () => {
      await approvedDay0()
      await switchOn()
      await rows().updateOne({}, { $set: { status: 'failed', attempts: 3, lastError: 'boom' } })
      const late = new Date(T0.getTime() + 2 * 24 * HOUR)
      const retried = await applySocialPostAction(
        db,
        (await row(0, 'instagram'))._id.toHexString(),
        'retry',
        'behic',
        late,
      )
      expect(retried).toMatchObject({ status: 'approved', attempts: 0, lastError: null })

      const instagram = recorder('instagram', ok('media-1'))
      await runSocialAutopostTick(db, { instagram: instagram.adapter }, silent, late)
      expect((await row(0, 'instagram')).status).toBe('published')
    })
  })

  it('lets the panel approve a draft, skip it, and not retry what has not failed', async () => {
    await importSocialSlots(db, [slot(0, 'instagram')], T0)
    const id = (await row(0, 'instagram'))._id.toHexString()

    expect(await applySocialPostAction(db, id, 'retry', 'behic', T0)).toBeNull()
    expect((await applySocialPostAction(db, id, 'approve', 'behic', T0))?.status).toBe('approved')
    expect((await applySocialPostAction(db, id, 'skip', 'behic', T0))?.status).toBe('skipped')
    expect(await applySocialPostAction(db, 'not-an-id', 'skip', 'behic', T0)).toBeNull()
  })

  it('lists the next days that have not gone out for the dry run', async () => {
    await importSocialSlots(
      db,
      [slot(0, 'instagram'), slot(0, 'tiktok'), slot(1, 'instagram'), slot(2, 'instagram')],
      T0,
    )
    const next = await nextSocialPosts(db, 2, new Date(T0.getTime() - HOUR))
    expect(next.map((post) => `${post.dayOffset}/${post.platform}`)).toEqual([
      '0/instagram',
      '0/tiktok',
      '1/instagram',
    ])
  })
})
