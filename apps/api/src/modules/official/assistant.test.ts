import { MongoMemoryServer } from 'mongodb-memory-server'
import { ObjectId } from 'mongodb'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { MAX_MESSAGE_LENGTH, OFFICIAL_ASSISTANT } from '@langx/shared'
import { assistantCallsToday } from './assistantBudget'
import { deliverOfficialMessage } from './deliver'
import { connectToDatabase, type DbHandle } from '../../db/client'
import { COLLECTIONS } from '../../db/collections'
import { ensureIndexes } from '../../db/indexes'
import { startConversation, type Conversation, type Message } from '../chat/conversations'
import type { Profile } from '../profiles/profiles'
import { ensureOfficialAccounts, officialIds } from './accounts'
import { respondAsOfficial } from './assistant'
import type { AssistantProvider, AssistantRequest } from './assistantProvider'

const SUPPORT = 'hi@langx.test'

/**
 * Real account ids, because `emailFor` puts one through `authId` — a name like
 * 'ada' passes every assertion here and throws on the one path that reaches
 * Better Auth's collections.
 */
const ADA = new ObjectId().toHexString()
const BO = new ObjectId().toHexString()

function person(id: string, handle: string, native = 'tr'): Profile {
  const now = new Date()
  return {
    _id: id,
    handle,
    displayName: handle,
    birthDate: '1995-06-15',
    gender: 'undisclosed',
    nativeLanguages: [{ code: native }],
    learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
    interests: [],
    settings: { discoverable: true, notifications: true },
    privacy: { incognito: false },
    entitlement: { tier: 'free', updatedAt: now },
    quota: { initiations: [], translations: [], media: [] },
    streak: { current: 0, longest: 0, lastQualifiedDay: null },
    stats: { lastActiveAt: now, messagesSent: 0 },
    createdAt: now,
    updatedAt: now,
  }
}

/** Records what it was asked and answers with whatever the test set. */
class FakeAssistant implements AssistantProvider {
  requests: AssistantRequest[] = []
  answer: string | null = 'the answer'

  respond(request: AssistantRequest): Promise<string | null> {
    this.requests.push(request)
    return Promise.resolve(this.answer)
  }
}

describe('answering as an official account', () => {
  let server: MongoMemoryServer
  let handle: DbHandle
  let assistant: FakeAssistant
  let sent: { to: string }[]

  /**
   * Enough of an app for this path: the database, the two decorations it
   * reads, a socket server that emits into nothing and a logger that says
   * nothing. Building the real one would mean Better Auth and a replica set to
   * exercise a function that touches neither.
   */
  function appStub(): FastifyInstance {
    return {
      mongo: { db: handle.db },
      env: {
        SUPPORT_EMAIL: SUPPORT,
        // What `submitFeedback` reads on its way to the mailbox: the signing
        // secret for the bounty link and the repository the prefilled issue
        // points at.
        BETTER_AUTH_SECRET: 'test-secret',
        BETTER_AUTH_URL: 'https://api.langx.test',
        GITHUB_ISSUE_REPO: 'langx/langx',
      },
      assistant,
      io: {
        to: () => ({ emit: () => undefined }),
        in: () => ({ fetchSockets: () => Promise.resolve([]) }),
      },
      email: {
        send: (message: { to: string }) => {
          sent.push(message)
          return Promise.resolve()
        },
      },
      log: { error: () => undefined, warn: () => undefined },
    } as unknown as FastifyInstance
  }

  async function write(from: string, to: string, body: string): Promise<Conversation> {
    const { conversation, message } = await startConversation(handle.db, from, {
      toUserId: to,
      body,
    })
    await respondAsOfficial(appStub(), conversation, message)
    return conversation
  }

  /** A reply into a thread that already exists, which `startConversation` refuses. */
  async function sendAgain(
    from: string,
    to: string,
    body: string,
  ): Promise<{ conversation: Conversation; message: Message }> {
    const conversation = (await handle.db
      .collection<Conversation>(COLLECTIONS.conversations)
      .findOne({ participants: { $all: [from, to] } }))!
    const message: Message = {
      _id: new ObjectId(),
      conversationId: conversation._id,
      senderId: from,
      type: 'text',
      body,
      createdAt: new Date(),
    }
    await handle.db.collection<Message>(COLLECTIONS.messages).insertOne(message)
    return { conversation, message }
  }

  async function saidTo(userId: string): Promise<string[]> {
    const rows = await handle.db
      .collection<Message>(COLLECTIONS.messages)
      .find({ senderId: { $ne: userId } })
      .sort({ createdAt: 1, _id: 1 })
      .toArray()
    return rows.map((row) => row.body)
  }

  beforeAll(async () => {
    server = await MongoMemoryServer.create()
    handle = await connectToDatabase(server.getUri(), 'langx_official_assistant_test')
    await ensureIndexes(handle.db)
  })

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
      COLLECTIONS.reports,
      COLLECTIONS.tokenLedger,
      COLLECTIONS.assistantUsage,
    ]) {
      await handle.db.collection(name).deleteMany({})
    }
    assistant = new FakeAssistant()
    sent = []
    await ensureOfficialAccounts(handle.db, 'https://api.langx.test')
    await handle.db.collection<Profile>(COLLECTIONS.profiles).insertOne(person(ADA, 'ada'))
  })

  it('answers @copilot immediately, without asking the model', async () => {
    await write(ADA, officialIds().get('copilot')!, 'when?')

    const replies = await saidTo(ADA)
    expect(replies).toHaveLength(1)
    // Turkish, because that is Ada's native language.
    expect(replies[0]).toContain('Copilot')
    expect(assistant.requests).toHaveLength(0)
  })

  it('gives @langx the conversation, oldest first, with the roles the right way round', async () => {
    const conversation = await write(ADA, officialIds().get('langx')!, 'how do tokens work?')

    expect(assistant.requests).toHaveLength(1)
    const request = assistant.requests[0]!
    expect(request.history).toEqual([{ role: 'user', text: 'how do tokens work?' }])
    // The numbers come from the config, so a changed limit changes the prompt.
    expect(request.system).toContain('5 new conversations a day')
    expect(request.system).toContain(SUPPORT)
    expect(request.tools.map((t) => t.name)).toEqual(['report_user', 'submit_feedback'])

    expect(await saidTo(ADA)).toEqual(['the answer'])
    expect(conversation.participants).toContain(ADA)
  })

  it('says the offline line when there is no key', async () => {
    assistant = new FakeAssistant()
    const app = appStub()
    // What production is without ANTHROPIC_API_KEY.
    ;(app as { assistant: AssistantProvider | null }).assistant = null

    const { conversation, message } = await startConversation(handle.db, ADA, {
      toUserId: officialIds().get('langx')!,
      body: 'hello?',
    })
    await respondAsOfficial(app, conversation, message)

    const replies = await saidTo(ADA)
    expect(replies).toHaveLength(1)
    expect(replies[0]).toContain(SUPPORT)
  })

  it('words a refusal rather than saying nothing', async () => {
    assistant.answer = null
    await write(ADA, officialIds().get('langx')!, 'do something forbidden')
    expect(await saidTo(ADA)).toHaveLength(1)
  })

  /**
   * The bound that turns a cap on replies into a cap on spend. A chat message
   * may be 2,000 characters and twenty of them reach the model on every turn.
   */
  it('cuts older messages down but never the question it is answering', async () => {
    const long = 'x'.repeat(MAX_MESSAGE_LENGTH)
    const langxId = officialIds().get('langx')!
    await write(ADA, langxId, long)
    assistant.requests = []

    const { conversation, message } = await sendAgain(ADA, langxId, long)
    await respondAsOfficial(appStub(), conversation, message)

    const history = assistant.requests[0]!.history
    expect(history.at(-1)!.text).toHaveLength(MAX_MESSAGE_LENGTH)
    for (const older of history.slice(0, -1)) {
      expect(older.text.length).toBeLessThanOrEqual(OFFICIAL_ASSISTANT.historyCharsPerMessage + 1)
    }
  })

  it('says nothing to a photo', async () => {
    const langxId = officialIds().get('langx')!
    const { conversation, message } = await startConversation(handle.db, ADA, {
      toUserId: langxId,
      body: 'look',
    })
    await respondAsOfficial(appStub(), conversation, { ...message, type: 'image' })

    expect(await saidTo(ADA)).toEqual([])
    expect(assistant.requests).toHaveLength(0)
  })

  describe('the tools', () => {
    beforeEach(async () => {
      await handle.db.collection<Profile>(COLLECTIONS.profiles).insertOne(person(BO, 'bo'))
    })

    async function toolRun(name: string, input: unknown): Promise<string> {
      await write(ADA, officialIds().get('langx')!, 'hello')
      const tool = assistant.requests[0]!.tools.find((t) => t.name === name)!
      return tool.run(input)
    }

    it('files a report as the person writing, never as anyone else', async () => {
      const result = await toolRun('report_user', { handle: 'bo', reason: 'spam' })

      expect(result).toContain('@bo')
      const report = await handle.db
        .collection<{ reporterId: string; reportedId: string; reason: string }>(COLLECTIONS.reports)
        .findOne({})
      expect(report).toMatchObject({ reporterId: ADA, reportedId: BO, reason: 'spam' })
    })

    it('refuses a self-report and an official target', async () => {
      await toolRun('report_user', { handle: 'ada', reason: 'spam' })
      expect(await handle.db.collection(COLLECTIONS.reports).countDocuments()).toBe(0)

      await write(ADA, officialIds().get('copilot')!, 'x')
      const tool = assistant.requests[0]!.tools.find((t) => t.name === 'report_user')!
      expect(await tool.run({ handle: 'langx', reason: 'spam' })).toContain('official')
      expect(await handle.db.collection(COLLECTIONS.reports).countDocuments()).toBe(0)
    })

    it('sends feedback to the support mailbox', async () => {
      await toolRun('submit_feedback', {
        kind: 'bug',
        body: 'The chat list scrolls to the top whenever a message arrives.',
      })
      expect(sent.map((mail) => mail.to)).toEqual([SUPPORT])
    })
  })

  /**
   * The ceiling that bounds the bill rather than one conversation. Worded the
   * same as the per-person one on purpose — whose ceiling it was is not the
   * reader's problem.
   */
  it('stops answering everybody once the day’s budget is gone', async () => {
    await handle.db.collection(COLLECTIONS.assistantUsage).insertOne({
      _id: new Date().toISOString().slice(0, 10) as never,
      calls: OFFICIAL_ASSISTANT.globalRepliesPerDay,
      createdAt: new Date(),
    })

    await write(ADA, officialIds().get('langx')!, 'hello?')

    expect(assistant.requests).toHaveLength(0)
    const replies = await saidTo(ADA)
    expect(replies).toHaveLength(1)
    expect(replies[0]).toContain(SUPPORT)
  })

  /**
   * A welcome or an announcement is ours, not the model's — it costs nothing
   * and must not eat a slot. On announcement day that difference is the
   * assistant staying up.
   */
  it('spends no budget on a message it did not think about', async () => {
    await deliverOfficialMessage(handle.db, {
      fromHandle: 'langx',
      toUserId: ADA,
      body: 'an announcement',
      clientId: 'announcement:test',
    })
    expect(await assistantCallsToday(handle.db)).toBe(0)
  })

  it('stops answering once the daily ceiling is reached', async () => {
    const langxId = officialIds().get('langx')!
    const conversation = await write(ADA, langxId, 'first')

    // Everything @langx would have said today, straight into the collection —
    // the ceiling counts messages, and going through the model thirty times to
    // prove that would be thirty fake replies for the same assertion.
    const now = new Date()
    await handle.db.collection<Message>(COLLECTIONS.messages).insertMany(
      Array.from({ length: OFFICIAL_ASSISTANT.repliesPerDay }, () => ({
        _id: new ObjectId(),
        conversationId: conversation._id,
        senderId: langxId,
        type: 'text' as const,
        body: 'earlier',
        createdAt: now,
      })),
    )

    assistant.requests = []
    const { conversation: same, message } = await sendAgain(ADA, langxId, 'one more')
    await respondAsOfficial(appStub(), same, message)

    expect(assistant.requests).toHaveLength(0)
    const last = await handle.db
      .collection<Message>(COLLECTIONS.messages)
      .find({ senderId: langxId })
      .sort({ createdAt: -1, _id: -1 })
      .limit(1)
      .next()
    expect(last?.body).toContain(SUPPORT)
  })
})
