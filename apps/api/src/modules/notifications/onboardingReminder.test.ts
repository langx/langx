import { ObjectId } from 'mongodb'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import { authId } from '../../lib/authId'
import { ONBOARDING_LETTERS } from '../../email/onboardingReminderLetters'
import type { EmailMessage } from '../../email/sender'
import type { NotificationEmailContext } from '../../email/notify'
import { UNSUBSCRIBE_PLACEHOLDER } from './campaign'
import {
  isOldEnough,
  isReminderCandidate,
  ONBOARDING_REMINDER_MAX_AGE_HOURS,
  reminderCohort,
  reminderVariant,
  runOnboardingReminderPass,
} from './onboardingReminder'
import { suppressEmail } from './suppressions'

const NOW = new Date('2026-09-10T12:00:00.000Z')
const hoursAgo = (hours: number): Date => new Date(NOW.getTime() - hours * 3600_000)

describe('which letter a stalled signup gets', () => {
  it('sends the wizard reminder to a confirmed address', () => {
    expect(reminderVariant({ emailVerified: true })).toBe('reminder')
  })

  /**
   * `auth.ts` sets `requireEmailVerification`, so this person cannot sign in at
   * all. "Finish setting up your profile" would point them at a wall.
   */
  it('sends the confirm-first letter to an address nobody proved', () => {
    expect(reminderVariant({ emailVerified: false })).toBe('confirm')
    expect(reminderVariant({})).toBe('confirm')
  })
})

describe('who counts as a stalled signup', () => {
  it('accepts an ordinary account', () => {
    expect(isReminderCandidate({ _id: '1', email: 'a@b.test' })).toBe(true)
  })

  it('refuses a guest — a browsing session is not a signup', () => {
    expect(isReminderCandidate({ _id: '1', email: 'a@b.test', isAnonymous: true })).toBe(false)
    expect(isReminderCandidate({ _id: '1', email: 'anon-1@guest.langx.invalid' })).toBe(false)
  })

  it('refuses a v1 row, which nobody signed up for and nobody abandoned', () => {
    expect(isReminderCandidate({ _id: '1', email: 'a@b.test', precreatedFromV1: {} })).toBe(false)
  })

  it('refuses the account the API opens at every boot', () => {
    expect(isReminderCandidate({ _id: '1', email: 'warmup@internal.langx.invalid' })).toBe(false)
  })

  it('keeps a real address that merely looks synthetic', () => {
    expect(isReminderCandidate({ _id: '1', email: 'not.langx.invalid@example.test' })).toBe(true)
  })

  it('refuses a row with no address to write to', () => {
    expect(isReminderCandidate({ _id: '1' })).toBe(false)
  })
})

describe('the age floor', () => {
  it('leaves alone somebody who may still be filling the form', () => {
    expect(isOldEnough({ createdAt: hoursAgo(2) }, NOW, 24)).toBe(false)
  })

  it('includes somebody who put their phone down a day ago', () => {
    expect(isOldEnough({ createdAt: hoursAgo(25) }, NOW, 24)).toBe(true)
  })

  it('is a flag, so a first manual run can reach further back', () => {
    expect(isOldEnough({ createdAt: hoursAgo(20) }, NOW, 24)).toBe(false)
    expect(isOldEnough({ createdAt: hoursAgo(20) }, NOW, 12)).toBe(true)
  })

  it('refuses a row with no signup date rather than guessing one', () => {
    expect(isOldEnough({}, NOW, 24)).toBe(false)
  })
})

describe('reading the cohort out of the database', () => {
  let mongo: MongoMemoryServer
  let handle: DbHandle

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    handle = await connectToDatabase(mongo.getUri(), 'onboarding_reminder_test')
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
      COLLECTIONS.notificationLedger,
      COLLECTIONS.emailSuppressions,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
  })

  async function signUp(
    opts: {
      onboarded?: boolean
      verified?: boolean
      anonymous?: boolean
      fromV1?: boolean
      email?: string
      name?: string
      hoursOld?: number
    } = {},
  ): Promise<string> {
    const userId = new ObjectId().toHexString()
    if (opts.onboarded) {
      await handle.db
        .collection(COLLECTIONS.profiles)
        .insertOne({ _id: userId, handle: `h${userId.slice(-12)}`, displayName: 'Sofia' } as never)
    }
    await handle.db.collection(COLLECTIONS.user).insertOne({
      _id: authId(userId),
      email: opts.email ?? `${userId}@example.test`,
      emailVerified: opts.verified ?? true,
      createdAt: hoursAgo(opts.hoursOld ?? 48),
      ...(opts.name ? { name: opts.name } : {}),
      ...(opts.anonymous ? { isAnonymous: true } : {}),
      ...(opts.fromV1 ? { precreatedFromV1: { at: new Date() } } : {}),
    })
    return userId
  }

  it('returns the person who signed up and never finished', async () => {
    const stalled = await signUp({ name: '  Manon  ' })
    await signUp({ onboarded: true })

    const cohort = await reminderCohort(handle.db, { now: NOW })
    expect(cohort).toHaveLength(1)
    expect(cohort[0]?.userId).toBe(stalled)
    expect(cohort[0]?.variant).toBe('reminder')
    expect(cohort[0]?.name).toBe('Manon')
  })

  /**
   * The join that decides the whole cohort. `user._id` is an ObjectId and
   * `profiles._id` is its string form — matching them the wrong way round
   * would find no profiles at all and mail every member the product has.
   */
  it('does not mistake an onboarded member for a drop-off', async () => {
    await signUp({ onboarded: true })
    await signUp({ onboarded: true })
    expect(await reminderCohort(handle.db, { now: NOW })).toEqual([])
  })

  it('splits the two letters by whether the address was ever confirmed', async () => {
    await signUp({ verified: true, hoursOld: 72 })
    await signUp({ verified: false, hoursOld: 71 })

    const cohort = await reminderCohort(handle.db, { now: NOW })
    expect(cohort.map((r) => r.variant)).toEqual(['reminder', 'confirm'])
  })

  it('leaves out guests, v1 rows and anybody still mid-form', async () => {
    await signUp({ anonymous: true })
    await signUp({ fromV1: true })
    await signUp({ email: 'anon-9@guest.langx.invalid' })
    await signUp({ hoursOld: 1 })
    expect(await reminderCohort(handle.db, { now: NOW })).toEqual([])
  })

  it('is ordered oldest first, so a limited run starts with the longest wait', async () => {
    await signUp({ hoursOld: 30, email: 'newer@example.test' })
    await signUp({ hoursOld: 90, email: 'older@example.test' })

    const cohort = await reminderCohort(handle.db, { now: NOW })
    expect(cohort.map((r) => r.email)).toEqual(['older@example.test', 'newer@example.test'])

    const limited = await reminderCohort(handle.db, { now: NOW, limit: 1 })
    expect(limited.map((r) => r.email)).toEqual(['older@example.test'])
  })
  /**
   * The scheduled half. Everything above decides *who*; these decide what the
   * timer does with that answer — and the two that matter are the ones that
   * stop it: the ledger, and the week.
   */
  describe('the pass the scheduler runs', () => {
    function collector(): { sent: EmailMessage[]; email: NotificationEmailContext } {
      const sent: EmailMessage[] = []
      return {
        sent,
        email: {
          sender: {
            send: (message: EmailMessage) => {
              sent.push(message)
              return Promise.resolve()
            },
            sendBatch: (messages: EmailMessage[]) => {
              sent.push(...messages)
              return Promise.resolve()
            },
          },
          unsubscribeSecret: 'a'.repeat(32),
          apiBaseUrl: 'https://api.langx.test',
        } as NotificationEmailContext,
      }
    }

    it('writes each letter to the person whose step it describes', async () => {
      await signUp({ email: 'confirmed@example.test', verified: true })
      await signUp({ email: 'unproven@example.test', verified: false })

      const { sent, email } = collector()
      const result = await runOnboardingReminderPass(handle.db, email, NOW)

      expect(result.sent).toBe(2)
      const bySubject = new Map(sent.map((m) => [m.to, m.subject]))
      expect(bySubject.get('confirmed@example.test')).toBe(ONBOARDING_LETTERS.reminder.subject)
      expect(bySubject.get('unproven@example.test')).toBe(ONBOARDING_LETTERS.confirm.subject)
    })

    /** The whole promise the letter makes out loud, kept by the ledger. */
    it('never writes a second time, however often the timer fires', async () => {
      await signUp({ email: 'once@example.test' })

      const first = collector()
      expect((await runOnboardingReminderPass(handle.db, first.email, NOW)).sent).toBe(1)

      const second = collector()
      const again = await runOnboardingReminderPass(handle.db, second.email, NOW)
      expect(again.sent).toBe(0)
      expect(second.sent).toHaveLength(0)
    })

    /**
     * Without this bound, switching the timer on would mail every abandoned
     * sign-up the app has ever had, in one tick.
     */
    it('leaves a sign-up older than the window alone', async () => {
      await signUp({
        email: 'ancient@example.test',
        hoursOld: ONBOARDING_REMINDER_MAX_AGE_HOURS + 1,
      })

      const { sent, email } = collector()
      expect((await runOnboardingReminderPass(handle.db, email, NOW)).sent).toBe(0)
      expect(sent).toHaveLength(0)
    })

    it('leaves somebody who is still mid-wizard alone', async () => {
      await signUp({ email: 'midform@example.test', hoursOld: 1 })

      const { sent, email } = collector()
      expect((await runOnboardingReminderPass(handle.db, email, NOW)).sent).toBe(0)
      expect(sent).toHaveLength(0)
    })

    /**
     * The script does not check this, and a one-off run is somebody watching.
     * A timer is not, so an address that bounced or complained must not be
     * written to again by a machine.
     */
    it('does not write to an address that bounced', async () => {
      await signUp({ email: 'bounced@example.test' })
      await suppressEmail(handle.db, { email: 'bounced@example.test', reason: 'bounced' })

      const { sent, email } = collector()
      const result = await runOnboardingReminderPass(handle.db, email, NOW)
      expect(result.sent).toBe(0)
      expect(result.skipped).toBe(1)
      expect(sent).toHaveLength(0)
    })

    it('leaves no unsubscribe placeholder in what it sends', async () => {
      await signUp({ email: 'out@example.test' })

      const { sent, email } = collector()
      await runOnboardingReminderPass(handle.db, email, NOW)

      const message = sent[0]
      expect(message?.html).not.toContain(UNSUBSCRIBE_PLACEHOLDER)
      expect(message?.text).not.toContain(UNSUBSCRIBE_PLACEHOLDER)
      expect(message?.html).toContain('https://api.langx.test')
      expect(message?.headers?.['List-Unsubscribe']).toContain('https://api.langx.test')
    })
  })
})
