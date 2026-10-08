import { MongoMemoryServer } from 'mongodb-memory-server'
import { SUSPENSION_FOREVER } from '@langx/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import { translator } from '../../i18n'
import type { Message } from '../chat/conversations'
import { ensureOfficialAccounts } from '../official/accounts'
import type { Profile } from '../profiles/profiles'
import {
  runSuspensionEndedPass,
  SUSPENSION_ENDED_MAX_AGE_MS,
  type SuspensionEndedDeps,
} from './suspensionEnded'

const NOW = new Date('2026-10-07T12:00:00Z')
const HOUR_MS = 60 * 60 * 1000

function person(id: string): Profile {
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
    entitlement: { tier: 'free', updatedAt: NOW },
    quota: { initiations: [], translations: [], media: [] },
    streak: { current: 0, longest: 0, lastQualifiedDay: null },
    stats: { lastActiveAt: NOW, messagesSent: 0 },
    createdAt: NOW,
    updatedAt: NOW,
  }
}

describe('the note when a suspension runs out', () => {
  let server: MongoMemoryServer
  let handle: DbHandle
  let fanOut: ReturnType<typeof vi.fn<SuspensionEndedDeps['fanOut']>>
  let deps: SuspensionEndedDeps

  beforeAll(async () => {
    server = await MongoMemoryServer.create()
    handle = await connectToDatabase(server.getUri(), 'langx_suspension_ended_test')
    // `sender_client_id_unique` is half of what makes this once-only.
    await ensureIndexes(handle.db)
  }, 60_000)

  afterAll(async () => {
    await handle.close()
    await server.stop()
  })

  beforeEach(async () => {
    for (const name of [
      COLLECTIONS.profiles,
      COLLECTIONS.user,
      COLLECTIONS.conversations,
      COLLECTIONS.messages,
      COLLECTIONS.tokenLedger,
      COLLECTIONS.notificationLedger,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
    await ensureOfficialAccounts(handle.db, 'https://api.langx.test')
    fanOut = vi.fn<SuspensionEndedDeps['fanOut']>().mockResolvedValue(undefined)
    deps = { fanOut, warn: vi.fn() }
  })

  /** Suspended for a day, ending `endedAgoMs` before NOW — or after it, when negative. */
  async function suspended(
    id: string,
    opts: { endedAgoMs: number; permanent?: boolean } = { endedAgoMs: HOUR_MS },
  ): Promise<void> {
    const until = opts.permanent
      ? new Date(SUSPENSION_FOREVER)
      : new Date(NOW.getTime() - opts.endedAgoMs)
    await handle.db.collection<Profile>(COLLECTIONS.profiles).insertOne({
      ...person(id),
      suspension: {
        at: new Date(until.getTime() - 24 * HOUR_MS),
        until,
        permanent: opts.permanent === true,
        reason: 'harassment',
      },
    })
  }

  function messagesTo(userId: string): Promise<Message[]> {
    return handle.db
      .collection<Message>(COLLECTIONS.messages)
      .find({ clientId: { $regex: `^suspensionEnded:${userId}:` } })
      .toArray()
  }

  it('says nothing while the suspension is in force', async () => {
    await suspended('ada', { endedAgoMs: -HOUR_MS })

    expect(await runSuspensionEndedPass(handle.db, deps, NOW)).toEqual({ sent: 0 })
    expect(await messagesTo('ada')).toHaveLength(0)
    expect(fanOut).not.toHaveBeenCalled()
  })

  it('says nothing about a permanent suspension, which never ends', async () => {
    await suspended('ada', { endedAgoMs: 0, permanent: true })

    expect(await runSuspensionEndedPass(handle.db, deps, NOW)).toEqual({ sent: 0 })
    expect(await messagesTo('ada')).toHaveLength(0)
  })

  it('writes once, in their language and with a knock, and never again', async () => {
    await suspended('ada', { endedAgoMs: HOUR_MS })

    expect(await runSuspensionEndedPass(handle.db, deps, NOW)).toEqual({ sent: 1 })

    const written = await messagesTo('ada')
    expect(written).toHaveLength(1)
    // `localeFor` reads the native language, and ada's is Turkish.
    expect(written[0]?.body).toBe(translator('tr')('official.suspensionEnded'))
    expect(fanOut).toHaveBeenCalledTimes(1)
    const [delivery, options] = fanOut.mock.calls[0] ?? []
    expect(delivery?.message.clientId).toBe(written[0]?.clientId)
    expect(options).toEqual({ push: true })

    // The claim is keyed on the end date, so the next tick finds it spent —
    // and the ledger's answer is what stops the push, since the message
    // would be handed back as already written rather than refused.
    expect(
      await runSuspensionEndedPass(handle.db, deps, new Date(NOW.getTime() + 30 * 60_000)),
    ).toEqual({ sent: 0 })
    expect(await messagesTo('ada')).toHaveLength(1)
    expect(fanOut).toHaveBeenCalledTimes(1)
  })

  /**
   * The record is never cleared when it runs out, so without the far end the
   * first run of this pass would write to everybody ever suspended.
   */
  it('says nothing about a suspension that ended more than a day ago', async () => {
    await suspended('ada', { endedAgoMs: SUSPENSION_ENDED_MAX_AGE_MS + 60_000 })

    expect(await runSuspensionEndedPass(handle.db, deps, NOW)).toEqual({ sent: 0 })
    expect(await messagesTo('ada')).toHaveLength(0)
  })

  it('says nothing to a deleted account', async () => {
    await suspended('ada', { endedAgoMs: HOUR_MS })
    await handle.db
      .collection<Profile>(COLLECTIONS.profiles)
      .updateOne({ _id: 'ada' }, { $set: { deletedAt: NOW } })

    expect(await runSuspensionEndedPass(handle.db, deps, NOW)).toEqual({ sent: 0 })
    expect(await messagesTo('ada')).toHaveLength(0)
  })

  it('writes again when a second suspension ends, because that is a second date', async () => {
    await suspended('ada', { endedAgoMs: HOUR_MS })
    expect(await runSuspensionEndedPass(handle.db, deps, NOW)).toEqual({ sent: 1 })

    // Suspended once more, for a day that has also passed by the next look.
    const later = new Date(NOW.getTime() + 3 * 24 * HOUR_MS)
    await handle.db.collection<Profile>(COLLECTIONS.profiles).updateOne(
      { _id: 'ada' },
      {
        $set: {
          suspension: {
            at: new Date(later.getTime() - 2 * HOUR_MS - 24 * HOUR_MS),
            until: new Date(later.getTime() - 2 * HOUR_MS),
            permanent: false,
            reason: 'spam',
          },
        },
      },
    )

    expect(await runSuspensionEndedPass(handle.db, deps, later)).toEqual({ sent: 1 })
    expect(await messagesTo('ada')).toHaveLength(2)
    expect(fanOut).toHaveBeenCalledTimes(2)
  })
})
