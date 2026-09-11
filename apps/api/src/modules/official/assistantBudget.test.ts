import { MongoMemoryServer } from 'mongodb-memory-server'
import { OFFICIAL_ASSISTANT } from '@langx/shared'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { assistantCallsToday, claimAssistantCall } from './assistantBudget'

const CAP = OFFICIAL_ASSISTANT.globalRepliesPerDay

describe("the assistant's daily budget", () => {
  let server: MongoMemoryServer
  let handle: DbHandle

  beforeAll(async () => {
    server = await MongoMemoryServer.create()
    handle = await connectToDatabase(server.getUri(), 'langx_assistant_budget_test')
  })

  afterAll(async () => {
    await handle.close()
    await server.stop()
  })

  beforeEach(async () => {
    await handle.db.collection(COLLECTIONS.assistantUsage).deleteMany({})
  })

  it('hands out exactly the cap and then stops', async () => {
    const day = new Date('2026-09-10T12:00:00Z')
    // Everything but the last one, written straight in — claiming five hundred
    // slots one at a time proves nothing the boundary does not.
    await handle.db
      .collection(COLLECTIONS.assistantUsage)
      .insertOne({ _id: '2026-09-10' as never, calls: CAP - 1, createdAt: day })

    expect(await claimAssistantCall(handle.db, day)).toBe(true)
    expect(await claimAssistantCall(handle.db, day)).toBe(false)
    expect(await claimAssistantCall(handle.db, day)).toBe(false)
    expect(await assistantCallsToday(handle.db, day)).toBe(CAP)
  })

  it('starts the next UTC day fresh', async () => {
    const full = new Date('2026-09-10T23:59:00Z')
    await handle.db
      .collection(COLLECTIONS.assistantUsage)
      .insertOne({ _id: '2026-09-10' as never, calls: CAP, createdAt: full })
    expect(await claimAssistantCall(handle.db, full)).toBe(false)

    const tomorrow = new Date('2026-09-11T00:01:00Z')
    expect(await claimAssistantCall(handle.db, tomorrow)).toBe(true)
    expect(await assistantCallsToday(handle.db, tomorrow)).toBe(1)
  })

  /**
   * The reason this is one update rather than a read and a write: at the
   * boundary, concurrent claims must not both succeed.
   */
  it('gives one slot to one caller when they race for the last one', async () => {
    const day = new Date('2026-09-10T12:00:00Z')
    await handle.db
      .collection(COLLECTIONS.assistantUsage)
      .insertOne({ _id: '2026-09-10' as never, calls: CAP - 1, createdAt: day })

    const results = await Promise.all(
      Array.from({ length: 8 }, () => claimAssistantCall(handle.db, day)),
    )
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(await assistantCallsToday(handle.db, day)).toBe(CAP)
  })

  it('counts from nothing on a day that has never been seen', async () => {
    expect(await assistantCallsToday(handle.db, new Date('2026-01-01T00:00:00Z'))).toBe(0)
    expect(await claimAssistantCall(handle.db, new Date('2026-01-01T00:00:00Z'))).toBe(true)
  })
})
