import { COPILOT_RULES, PLAN_LIMITS } from '@langx/shared'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { ObjectId } from 'mongodb'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import type { ApiError } from '../../lib/ApiError'
import type { StructuredProvider, StructuredRequest } from '../official/assistantProvider'
import { claimCopilotCall } from './budget'
import { recordCopilotConsent, withdrawCopilotConsent } from './consent'
import { askCopilot, getCopilotStatus, type CopilotDeps, type CopilotQuestion } from './copilot'
import { systemPromptFor } from './prompts'

/**
 * A model that answers without a network, and remembers every question —
 * which is how "nothing reaches the provider" is asserted rather than hoped.
 */
class FakeModel implements StructuredProvider {
  readonly model = 'fake-model'
  readonly asked: StructuredRequest<unknown>[] = []
  /** Replaced per test to decline (`null`) or fail (`throw`). */
  answer: (request: StructuredRequest<unknown>) => unknown = (request) => {
    if (request.system === systemPromptFor('check')) {
      return { corrected: 'I have an apple.', reason: 'Use "an" before a vowel sound.' }
    }
    if (request.system === systemPromptFor('replyIdeas')) {
      return { ideas: [' Sounds good! ', 'What time?', '', 'See you then.', 'One too many.'] }
    }
    return { explanation: '"an" comes before a vowel sound.' }
  }

  ask<T>(request: StructuredRequest<T>): Promise<T | null> {
    this.asked.push(request)
    try {
      return Promise.resolve(this.answer(request as StructuredRequest<unknown>) as T | null)
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)))
    }
  }
}

const NOW = new Date('2026-10-18T12:00:00Z')
const ADULT = '1995-06-15'
/** Seventeen today: eighteen tomorrow. Year-only arithmetic would call this eighteen. */
const SEVENTEEN = '2008-10-19'

describe('Copilot', () => {
  let server: MongoMemoryServer
  let handle: DbHandle
  let model: FakeModel
  let deps: CopilotDeps
  let me: string
  let partner: string
  let stranger: string
  let conversationId: string

  async function seedProfile(
    id: string,
    overrides: { birthDate?: string; tier?: 'free' | 'pro'; consent?: number } = {},
  ) {
    await handle.db.collection(COLLECTIONS.profiles).insertOne({
      _id: id as never,
      handle: id,
      displayName: `Name of ${id}`,
      birthDate: overrides.birthDate ?? ADULT,
      nativeLanguages: [{ code: 'tr' }],
      learning: [{ code: 'en', level: 'beginner', priority: 1 }],
      entitlement: { tier: overrides.tier ?? 'free', updatedAt: NOW },
      quota: { initiations: [], translations: [], media: [] },
      ...(overrides.consent !== undefined
        ? { copilotConsent: { version: overrides.consent, at: NOW } }
        : {}),
    })
  }

  /** Each message a second after the last, so the thread has an order. */
  let clock = 0
  async function addMessage(fields: Record<string, unknown>): Promise<string> {
    const _id = new ObjectId()
    await handle.db.collection(COLLECTIONS.messages).insertOne({
      _id,
      conversationId: new ObjectId(conversationId),
      type: 'text',
      createdAt: new Date(NOW.getTime() + clock++ * 1000),
      ...fields,
    })
    return _id.toHexString()
  }

  function check(text = 'I have a apple.'): CopilotQuestion {
    return { action: 'check', conversationId, text }
  }

  async function refusal(promise: Promise<unknown>): Promise<ApiError> {
    try {
      await promise
    } catch (error) {
      return error as ApiError
    }
    throw new Error('expected a refusal')
  }

  async function quotaUsed(userId: string): Promise<number> {
    const profile = await handle.db
      .collection<{ quota: { copilot?: Date[] } }>(COLLECTIONS.profiles)
      .findOne({ _id: userId as never })
    return profile?.quota.copilot?.length ?? 0
  }

  beforeAll(async () => {
    server = await MongoMemoryServer.create()
    handle = await connectToDatabase(server.getUri(), 'langx_copilot_test')
    await ensureIndexes(handle.db)
  })

  afterAll(async () => {
    await handle.close()
    await server.stop()
  })

  beforeEach(async () => {
    for (const name of [
      COLLECTIONS.profiles,
      COLLECTIONS.conversations,
      COLLECTIONS.messages,
      COLLECTIONS.blocks,
      COLLECTIONS.copilotCache,
      COLLECTIONS.copilotUsage,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
    model = new FakeModel()
    deps = { db: handle.db, provider: model, enabled: true, log: { error: () => undefined } }
    me = 'me-user'
    partner = 'partner-user'
    stranger = 'stranger-user'
    await seedProfile(me, { consent: COPILOT_RULES.consentVersion })
    await seedProfile(partner)
    await seedProfile(stranger, { consent: COPILOT_RULES.consentVersion })
    const conversation = await handle.db.collection(COLLECTIONS.conversations).insertOne({
      participants: [me, partner],
      pairKey: `${me}_${partner}`,
      createdAt: NOW,
    })
    conversationId = conversation.insertedId.toHexString()
  })

  describe('with the switch off or no key', () => {
    it('is off, and asks nothing, when the operator switch is off', async () => {
      const error = await refusal(askCopilot({ ...deps, enabled: false }, me, 'en', check(), NOW))
      expect(error.code).toBe('COPILOT_UNAVAILABLE')
      expect(error.reason).toBe('off')
      expect(model.asked).toHaveLength(0)
      expect(await quotaUsed(me)).toBe(0)
    })

    it('is off with the switch on but no key — the key and the switch are both needed', async () => {
      const error = await refusal(askCopilot({ ...deps, provider: null }, me, 'en', check(), NOW))
      expect(error.reason).toBe('off')
    })

    it('says so in the status, without failing', async () => {
      const status = await getCopilotStatus({ ...deps, enabled: false }, me, NOW)
      expect(status).toMatchObject({ available: false, reason: 'off', consented: true })
      expect(status.quota.limit).toBe(PLAN_LIMITS.free.copilotPer24h)
    })
  })

  describe('the consent gate', () => {
    it('sends nothing to the model before the person agrees', async () => {
      await withdrawCopilotConsent(handle.db, me)
      const error = await refusal(askCopilot(deps, me, 'en', check(), NOW))
      expect(error.code).toBe('COPILOT_CONSENT_REQUIRED')
      expect(model.asked).toHaveLength(0)
      expect(await quotaUsed(me)).toBe(0)
    })

    it('does not count agreement to an older sheet', async () => {
      await handle.db
        .collection(COLLECTIONS.profiles)
        .updateOne(
          { _id: me as never },
          { $set: { copilotConsent: { version: COPILOT_RULES.consentVersion - 1, at: NOW } } },
        )
      const error = await refusal(askCopilot(deps, me, 'en', check(), NOW))
      expect(error.code).toBe('COPILOT_CONSENT_REQUIRED')
      expect(model.asked).toHaveLength(0)
    })

    it('records agreement to the current sheet only, and answers after it', async () => {
      await withdrawCopilotConsent(handle.db, me)
      const stale = await refusal(
        recordCopilotConsent(handle.db, me, COPILOT_RULES.consentVersion + 1, NOW),
      )
      expect(stale.reason).toBe('stale_consent')

      await recordCopilotConsent(handle.db, me, COPILOT_RULES.consentVersion, NOW)
      expect((await getCopilotStatus(deps, me, NOW)).consented).toBe(true)
      const answer = await askCopilot(deps, me, 'en', check(), NOW)
      expect(answer.source).toBe('ai')
    })

    it('stops at once when it is withdrawn', async () => {
      await askCopilot(deps, me, 'en', check('one'), NOW)
      await withdrawCopilotConsent(handle.db, me)
      const error = await refusal(askCopilot(deps, me, 'en', check('two'), NOW))
      expect(error.code).toBe('COPILOT_CONSENT_REQUIRED')
      expect(model.asked).toHaveLength(1)
    })
  })

  describe('for 16- and 17-year-olds', () => {
    it('is off by default, before consent or anything else is looked at', async () => {
      await handle.db
        .collection(COLLECTIONS.profiles)
        .updateOne({ _id: me as never }, { $set: { birthDate: SEVENTEEN } })
      const error = await refusal(askCopilot(deps, me, 'en', check(), NOW))
      expect(error.reason).toBe('age')
      expect(model.asked).toHaveLength(0)
      expect((await getCopilotStatus(deps, me, NOW)).reason).toBe('age')
    })

    it('opens on the eighteenth birthday, not the year before', async () => {
      await handle.db
        .collection(COLLECTIONS.profiles)
        .updateOne({ _id: me as never }, { $set: { birthDate: SEVENTEEN } })
      const birthday = new Date('2026-10-19T00:30:00Z')
      expect((await askCopilot(deps, me, 'en', check(), birthday)).source).toBe('ai')
    })

    /**
     * Off for them has to mean their words stay here too — not only that
     * their own button is missing — or any adult they talk to sends them.
     */
    it('sends none of their words when an adult asks in a chat with one', async () => {
      await handle.db
        .collection(COLLECTIONS.profiles)
        .updateOne({ _id: partner as never }, { $set: { birthDate: SEVENTEEN } })
      const text = await addMessage({ senderId: me, body: 'I have a apple.' })
      const correction = await addMessage({
        senderId: partner,
        type: 'correction',
        body: 'I have an apple.',
        correction: {
          targetMessageId: new ObjectId(text),
          original: 'I have a apple.',
          corrected: 'I have an apple.',
        },
      })

      const ideas = await refusal(
        askCopilot(deps, me, 'en', { action: 'replyIdeas', conversationId }, NOW),
      )
      expect(ideas.reason).toBe('partner_age')
      const explain = await refusal(
        askCopilot(
          deps,
          me,
          'en',
          { action: 'explain', conversationId, messageId: correction },
          NOW,
        ),
      )
      expect(explain.reason).toBe('partner_age')
      expect(model.asked).toHaveLength(0)
      expect(await quotaUsed(me)).toBe(0)

      // Check sends only the asker's own sentence.
      expect((await askCopilot(deps, me, 'en', check(), NOW)).source).toBe('ai')
    })
  })

  describe('the allowance', () => {
    it("gives a free account its taste, then refuses with the limit's name", async () => {
      const limit = PLAN_LIMITS.free.copilotPer24h ?? 0
      for (let i = 0; i < limit; i++) {
        await askCopilot(deps, me, 'en', check(`sentence ${i}`), NOW)
      }
      const error = await refusal(askCopilot(deps, me, 'en', check('one more'), NOW))
      expect(error.code).toBe('QUOTA_EXCEEDED')
      expect(error.limit).toBe('copilotPer24h')
      expect(error.retryAt).toBeDefined()
      expect(model.asked).toHaveLength(limit)
    })

    it('gives Pro a higher ceiling, and a finite one', async () => {
      await handle.db
        .collection(COLLECTIONS.profiles)
        .updateOne({ _id: me as never }, { $set: { 'entitlement.tier': 'pro' } })
      const limit = PLAN_LIMITS.pro.copilotPer24h ?? 0
      expect(limit).toBeGreaterThan(PLAN_LIMITS.free.copilotPer24h ?? 0)
      for (let i = 0; i < limit; i++) {
        await askCopilot(deps, me, 'en', check(`sentence ${i}`), NOW)
      }
      const error = await refusal(askCopilot(deps, me, 'en', check('one more'), NOW))
      expect(error.code).toBe('QUOTA_EXCEEDED')
    })

    it('gives the unit back when the model declines', async () => {
      model.answer = () => null
      const error = await refusal(askCopilot(deps, me, 'en', check(), NOW))
      expect(error.reason).toBe('no_answer')
      expect(await quotaUsed(me)).toBe(0)
    })

    it('gives the unit back when the call fails', async () => {
      model.answer = () => {
        throw new Error('network down')
      }
      const error = await refusal(askCopilot(deps, me, 'en', check(), NOW))
      expect(error.reason).toBe('no_answer')
      expect(await quotaUsed(me)).toBe(0)
    })

    it("stops everybody at the global ceiling, and gives the person's unit back", async () => {
      await handle.db.collection(COLLECTIONS.copilotUsage).insertOne({
        _id: '2026-10-18' as never,
        calls: COPILOT_RULES.globalCallsPerDay,
        createdAt: NOW,
      })
      const error = await refusal(askCopilot(deps, me, 'en', check(), NOW))
      expect(error.reason).toBe('busy')
      expect(model.asked).toHaveLength(0)
      expect(await quotaUsed(me)).toBe(0)
      // The next UTC day is a fresh one.
      expect(await claimCopilotCall(handle.db, new Date('2026-10-19T00:01:00Z'))).toBe(true)
    })
  })

  describe('the cache', () => {
    it('answers the same question twice for one call and one unit', async () => {
      const first = await askCopilot(deps, me, 'en', check(), NOW)
      const second = await askCopilot(deps, me, 'en', check(), NOW)
      expect(first.cached).toBe(false)
      expect(second).toEqual({ ...first, cached: true })
      expect(model.asked).toHaveLength(1)
      expect(await quotaUsed(me)).toBe(1)
    })

    it('shares an answer between two people asking the same thing', async () => {
      const other = await handle.db.collection(COLLECTIONS.conversations).insertOne({
        participants: [stranger, partner],
        pairKey: `${partner}_${stranger}`,
        createdAt: NOW,
      })
      await askCopilot(deps, me, 'en', check(), NOW)
      const theirs = await askCopilot(
        deps,
        stranger,
        'en',
        {
          action: 'check',
          conversationId: other.insertedId.toHexString(),
          text: 'I have a apple.',
        },
        NOW,
      )
      expect(theirs.cached).toBe(true)
      expect(await quotaUsed(stranger)).toBe(0)
    })

    it('is a different question in a different reader language', async () => {
      await askCopilot(deps, me, 'en', check(), NOW)
      expect((await askCopilot(deps, me, 'tr', check(), NOW)).cached).toBe(false)
      expect(model.asked).toHaveLength(2)
    })

    it('keeps nothing that names the asker', async () => {
      await askCopilot(deps, me, 'en', check(), NOW)
      const rows = await handle.db.collection(COLLECTIONS.copilotCache).find().toArray()
      expect(rows).toHaveLength(1)
      expect(JSON.stringify(rows)).not.toContain(me)
      expect(rows[0]?.expiresAt).toEqual(
        new Date(NOW.getTime() + COPILOT_RULES.cacheDays * 24 * 60 * 60 * 1000),
      )
    })

    it('does not keep an answer the model did not give', async () => {
      model.answer = () => null
      await refusal(askCopilot(deps, me, 'en', check(), NOW))
      expect(await handle.db.collection(COLLECTIONS.copilotCache).countDocuments()).toBe(0)
    })
  })

  describe('what is asked', () => {
    it('refuses a thread the asker is not in, before anything is read for the model', async () => {
      const error = await refusal(askCopilot(deps, stranger, 'en', check(), NOW))
      expect(error.code).toBe('NOT_FOUND')
      expect(model.asked).toHaveLength(0)
    })

    it('refuses a thread with somebody blocked', async () => {
      await handle.db
        .collection(COLLECTIONS.blocks)
        .insertOne({ blockerId: partner, blockedId: me })
      const error = await refusal(askCopilot(deps, me, 'en', check(), NOW))
      expect(error.code).toBe('BLOCKED')
      expect(model.asked).toHaveLength(0)
    })

    it('checks a sentence, and works out "changed" itself', async () => {
      const answer = await askCopilot(deps, me, 'tr', check(), NOW)
      expect(answer.result).toEqual({
        action: 'check',
        corrected: 'I have an apple.',
        changed: true,
        reason: 'Use "an" before a vowel sound.',
      })
      const turn = JSON.parse(model.asked[0]?.prompt ?? '{}') as Record<string, unknown>
      expect(turn).toMatchObject({ sentence: 'I have a apple.', readerLanguage: 'Turkish' })

      model.answer = () => ({ corrected: 'All good.', reason: 'Nothing to fix.' })
      const unchanged = await askCopilot(deps, me, 'en', check('All good.'), NOW)
      expect(unchanged.result).toEqual({
        action: 'check',
        corrected: 'All good.',
        changed: false,
        reason: null,
      })
    })

    it('reads only text lines for reply ideas, by role, and offers at most the set number', async () => {
      await addMessage({ senderId: partner, body: 'Hi! Want to talk at six?' })
      await addMessage({ senderId: me, body: 'secret', deletedAt: NOW })
      await addMessage({ senderId: partner, type: 'audio', body: '' })
      await addMessage({ senderId: partner, body: 'gone', hiddenFor: [me] })
      await addMessage({ senderId: me, body: 'Yes' })

      const answer = await askCopilot(deps, me, 'en', { action: 'replyIdeas', conversationId }, NOW)
      expect(answer.result).toEqual({
        action: 'replyIdeas',
        ideas: ['Sounds good!', 'What time?', 'See you then.'],
      })
      const sent = model.asked[0]?.prompt ?? ''
      expect(JSON.parse(sent)).toMatchObject({
        thread: [
          { from: 'them', text: 'Hi! Want to talk at six?' },
          { from: 'me', text: 'Yes' },
        ],
      })
      // Text and languages only: no id, handle or name of either person.
      for (const leak of [me, partner, 'Name of', 'secret', 'gone'])
        expect(sent).not.toContain(leak)
    })

    it('has no reply ideas for an empty thread', async () => {
      const error = await refusal(
        askCopilot(deps, me, 'en', { action: 'replyIdeas', conversationId }, NOW),
      )
      expect(error.reason).toBe('empty_thread')
      expect(model.asked).toHaveLength(0)
    })

    it("explains a person's correction, and only a correction", async () => {
      const text = await addMessage({ senderId: me, body: 'I have a apple.' })
      const correction = await addMessage({
        senderId: partner,
        type: 'correction',
        body: 'I have an apple.',
        correction: {
          targetMessageId: new ObjectId(text),
          original: 'I have a apple.',
          corrected: 'I have an apple.',
        },
      })

      const wrong = await refusal(
        askCopilot(deps, me, 'en', { action: 'explain', conversationId, messageId: text }, NOW),
      )
      expect(wrong.reason).toBe('not_a_correction')

      const answer = await askCopilot(
        deps,
        me,
        'en',
        { action: 'explain', conversationId, messageId: correction },
        NOW,
      )
      expect(answer.result).toEqual({
        action: 'explain',
        explanation: '"an" comes before a vowel sound.',
      })
      expect(JSON.parse(model.asked[0]?.prompt ?? '{}')).toMatchObject({
        original: 'I have a apple.',
        corrected: 'I have an apple.',
        note: null,
        level: 'Beginner',
      })
    })
  })
})
