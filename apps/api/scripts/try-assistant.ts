/**
 * Asks @langx real questions against the real API, and prints what it says.
 *
 * The assistant's orchestration is covered by tests against a fake provider —
 * which account answers, the ceilings, what the tools write. What no test can
 * cover is whether the answers are any good, and that is the only question a
 * system prompt is ever really judged on. This is the loop for changing the
 * prompt and seeing what changed.
 *
 * Everything runs against an in-memory replica set, so it touches no database
 * anybody else is using, and it is thrown away at the end. The only real thing
 * is the model call.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env scripts/try-assistant.ts
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env scripts/try-assistant.ts "how do I block someone?"
 */
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { buildApp } from '../src/app'
import { createAuth } from '../src/auth'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { ensureIndexes } from '../src/db/indexes'
import { loadEnv } from '../src/env'
import { createRevenueCatClientFromEnv } from '../src/modules/billing/createRevenueCatClient'
import { ensureOfficialAccounts, officialIds } from '../src/modules/official/accounts'
import { createAnthropicProvider } from '../src/modules/official/assistantProvider'
import { sendTextMessage } from '../src/modules/chat/messages'
import {
  startConversation,
  type Conversation,
  type Message,
} from '../src/modules/chat/conversations'
import { createStorageProvider } from '../src/storage/createStorageProvider'
import { createTranslationProvider } from '../src/translation/createTranslationProvider'
import { CapturingEmailSender, signUpAndSignIn } from '../src/testSupport/authFlow'
import { fanOutMessage } from '../src/ws/fanOut'

/**
 * The questions worth asking, which are the ones where a wrong answer costs
 * something: the four it must refuse, the two it should now know, the one that
 * must reach a tool, and one in another language.
 */
const DEFAULT_QUESTIONS = [
  'hi, what is this account?',
  'how do I hide my location?',
  'can I change my gender now?',
  'how much does Polyglot cost?',
  'how many tokens do I have right now?',
  'what is new in the app this week?',
  'when is the LangX token listing, and what will it be worth?',
  'are you a real person?',
  'konumumu nasıl gizlerim?',
]

const PASSWORD = 'correct horse battery staple'
const DB = 'langx_try_assistant'

async function main(): Promise<void> {
  const questions = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const asked = questions.length > 0 ? questions : DEFAULT_QUESTIONS

  const base = loadEnv()
  if (!base.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set — there is nothing to try.')
  }

  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
  const handle = await connectToDatabase(replSet.getUri(), DB)

  const env = loadEnv({
    NODE_ENV: 'test',
    MONGODB_URI: replSet.getUri(),
    MONGODB_DB: DB,
    LOG_LEVEL: 'silent',
    BETTER_AUTH_SECRET: 'a'.repeat(32),
    BETTER_AUTH_URL: 'http://localhost:4000',
    ANTHROPIC_API_KEY: base.ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL: base.ANTHROPIC_MODEL,
  })

  await ensureIndexes(handle.db)
  await ensureOfficialAccounts(handle.db, 'http://localhost:4000')

  const emailSender = new CapturingEmailSender()
  const auth = await createAuth({ env, db: handle.db, client: handle.client, emailSender })
  const app = await buildApp({
    env,
    client: handle.client,
    db: handle.db,
    auth,
    storage: createStorageProvider(env),
    translation: createTranslationProvider(env),
    revenueCat: createRevenueCatClientFromEnv(env),
    email: emailSender,
    assistant: createAnthropicProvider(env),
  })
  await app.ready()

  try {
    // The replica set's first transaction is prone to a transient failure —
    // the same warm-up every suite here does.
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const warm = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-up/email',
        payload: { email: `warm-${String(attempt)}@example.com`, password: PASSWORD, name: 'Warm' },
      })
      if (warm.statusCode === 200) break
      await new Promise((resolve) => setTimeout(resolve, 200))
    }

    const user = await signUpAndSignIn(app, emailSender, {
      email: 'try@example.com',
      password: PASSWORD,
      name: 'Trying',
    })
    await app.inject({
      method: 'POST',
      url: '/profiles',
      headers: { cookie: user.cookie },
      payload: {
        handle: 'tryingone',
        displayName: 'Trying',
        birthDate: '1995-06-15',
        gender: 'undisclosed',
        nativeLanguages: [{ code: 'en' }],
        learning: [{ code: 'tr', level: 'intermediate', priority: 1 }],
      },
    })

    const langxId = officialIds().get('langx')
    if (!langxId) throw new Error('@langx was not created')
    console.log(`model: ${env.ANTHROPIC_MODEL}\n`)

    let conversation: Conversation | null = null
    for (const question of asked) {
      let message: Message
      if (!conversation) {
        const started = await startConversation(handle.db, user.userId, {
          toUserId: langxId,
          body: question,
        })
        conversation = started.conversation
        message = started.message
      } else {
        const sent = await sendTextMessage(handle.db, user.userId, {
          conversationId: conversation._id.toHexString(),
          body: question,
        })
        conversation = sent.conversation
        message = sent.message
      }

      const before = await handle.db
        .collection<Message>(COLLECTIONS.messages)
        .countDocuments({ senderId: langxId })
      // The real path: the trigger lives at the end of the fan-out.
      await fanOutMessage(app, app.io, conversation, message, { pushWhenAway: false })

      // The reply is deliberately not awaited by anything, so wait for it.
      const deadline = Date.now() + 60_000
      let reply: Message | null = null
      while (Date.now() < deadline) {
        const latest = await handle.db
          .collection<Message>(COLLECTIONS.messages)
          .find({ senderId: langxId })
          .sort({ createdAt: -1, _id: -1 })
          .limit(1)
          .next()
        const count = await handle.db
          .collection<Message>(COLLECTIONS.messages)
          .countDocuments({ senderId: langxId })
        if (count > before && latest) {
          reply = latest
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 500))
      }

      console.log(`\x1b[1m› ${question}\x1b[0m`)
      console.log(reply ? reply.body : '(no reply within 60s)')
      console.log()
    }

    const reports = await handle.db.collection(COLLECTIONS.reports).countDocuments()
    console.log(
      `reports filed: ${String(reports)} · support mails sent: ${String(emailSender.messages.length)}`,
    )
  } finally {
    await app.close()
    await handle.close()
    await replSet.stop()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
