import { MongoMemoryServer } from 'mongodb-memory-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import {
  registerDevice,
  sendPush,
  tokensFor,
  type Device,
  type PushResult,
  type PushSender,
} from './devices'

/**
 * A sender that answers what it is told to, so these tests are about the
 * pruning that follows a send and not about any provider's wire format —
 * that lives in `fcm.test.ts`.
 */
class ScriptedSender implements PushSender {
  constructor(private readonly invalid: string[]) {}
  send(): Promise<PushResult> {
    return Promise.resolve({ invalidTokens: this.invalid })
  }
}

describe('sendPush', () => {
  let server: MongoMemoryServer
  let handle: DbHandle

  beforeAll(async () => {
    server = await MongoMemoryServer.create()
    handle = await connectToDatabase(server.getUri(), 'langx_push_test')
    await ensureIndexes(handle.db)
  })

  afterAll(async () => {
    await handle.close()
    await server.stop()
  })

  beforeEach(async () => {
    await handle.db.collection(COLLECTIONS.devices).deleteMany({})
  })

  it('forgets the phone FCM says the app was uninstalled from', async () => {
    await registerDevice(handle.db, 'ada', { pushToken: 'phone-1', platform: 'ios' })
    await registerDevice(handle.db, 'ada', { pushToken: 'phone-2', platform: 'android' })

    await sendPush(handle.db, new ScriptedSender(['phone-2']), {
      to: ['phone-1', 'phone-2'],
      title: 'hi',
      body: 'there',
      data: { kind: 'message' },
    })

    // Left alone, a dead token stays on the account forever and every later
    // send spends a slot on a phone that will never show anything.
    expect(await tokensFor(handle.db, 'ada')).toEqual(['phone-1'])
  })

  it('leaves the collection alone when everything delivered', async () => {
    await registerDevice(handle.db, 'bo', { pushToken: 'phone-3', platform: 'ios' })

    await sendPush(handle.db, new ScriptedSender([]), {
      to: ['phone-3'],
      title: 'hi',
      body: 'there',
      data: { kind: 'message' },
    })

    const devices = await handle.db.collection<Device>(COLLECTIONS.devices).countDocuments()
    expect(devices).toBe(1)
  })
})
