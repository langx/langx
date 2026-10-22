import { MongoMemoryServer } from 'mongodb-memory-server'
import { ObjectId } from 'mongodb'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { collectUpcomingMeetings } from './meetings'

describe("tomorrow's calls in the evening digest", () => {
  let server: MongoMemoryServer
  let handle: DbHandle
  const now = new Date('2026-10-20T19:00:00Z')
  const tomorrow = new Date('2026-10-21T18:00:00Z')

  beforeAll(async () => {
    server = await MongoMemoryServer.create()
    handle = await connectToDatabase(server.getUri(), 'langx_meetings_digest_test')
  })

  afterAll(async () => {
    await handle.close()
    await server.stop()
  })

  beforeEach(async () => {
    for (const name of [COLLECTIONS.conversations, COLLECTIONS.messages, COLLECTIONS.blocks]) {
      await handle.db.collection(name).deleteMany({})
    }
  })

  async function agreed(a: string, b: string): Promise<void> {
    const conversationId = new ObjectId()
    await handle.db
      .collection(COLLECTIONS.conversations)
      .insertOne({ _id: conversationId, participants: [a, b] })
    await handle.db.collection(COLLECTIONS.messages).insertOne({
      _id: new ObjectId(),
      conversationId,
      senderId: a,
      type: 'meeting',
      body: '',
      meeting: { startsAt: tomorrow, durationMinutes: 30, status: 'accepted' },
      createdAt: now,
    })
  }

  it('lists an agreed call for both people', async () => {
    await agreed('ada', 'bo')
    const byUser = await collectUpcomingMeetings(handle.db, now)
    expect(byUser.get('ada')).toHaveLength(1)
    expect(byUser.get('bo')).toHaveLength(1)
  })

  /** "Tomorrow you have a call with Bo", sent to somebody who blocked Bo. */
  it('leaves out a call between two people when one has blocked the other', async () => {
    await agreed('ada', 'bo')
    await agreed('ada', 'cy')
    await handle.db
      .collection(COLLECTIONS.blocks)
      .insertOne({ _id: new ObjectId(), blockerId: 'bo', blockedId: 'ada', createdAt: now })

    const byUser = await collectUpcomingMeetings(handle.db, now)
    expect(byUser.get('ada')?.map((meeting) => meeting.withId)).toEqual(['cy'])
    expect(byUser.get('bo')).toBeUndefined()
  })
})
