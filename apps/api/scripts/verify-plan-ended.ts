/**
 * Sends the real "your plan has ended" letter to one address, end to end,
 * in a throwaway database nobody else is in.
 *
 * The route test already proves the wiring against a captured sender. What it
 * cannot prove is the part that only exists outside this repo: that Resend
 * accepts the message, that the template renders in a mail client, and that
 * the half-hour delay behaves on a real clock rather than an injected `now`.
 *
 *   pnpm --filter @langx/api exec tsx scripts/verify-plan-ended.ts <address>
 *
 * The database is created, used and dropped — `MONGODB_DB` is ignored on
 * purpose, so this cannot reach `langx` or `langx_dev` however it is run. It
 * writes to exactly one address, the one given on the command line.
 */
import { MongoClient, ObjectId } from 'mongodb'
import { COLLECTIONS } from '../src/db/collections'
import { createEmailSender } from '../src/email/sender'
import { loadEnv } from '../src/env'
import { runPlanEndedPass, PLAN_ENDED_DELAY_MS } from '../src/modules/billing/planEnded'
import type { Profile } from '../src/modules/profiles/profiles'

const address = process.argv[2]
if (!address) throw new Error('usage: verify-plan-ended.ts <address>')

const env = loadEnv()
const DB = 'langx_verify_plan_ended'
const client = new MongoClient(env.MONGODB_URI)
await client.connect()
const db = client.db(DB)

try {
  await db.dropDatabase()

  const _id = new ObjectId()
  const userId = _id.toHexString()
  const now = new Date()

  await db
    .collection(COLLECTIONS.user)
    .insertOne({ _id, email: address, emailVerified: true, createdAt: now })

  /** Turkish, so the letter arrives in the language the profile speaks. */
  await db.collection<Profile>(COLLECTIONS.profiles).insertOne({
    _id: userId,
    handle: 'planended',
    displayName: 'Plan Ended Check',
    birthDate: '1995-06-15',
    gender: 'undisclosed',
    nativeLanguages: [{ code: 'tr' }],
    learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
    interests: [],
    settings: { discoverable: false, notifications: true },
    privacy: { incognito: false },
    entitlement: { tier: 'free', willRenew: false, updatedAt: now },
    churnedFrom: { tier: 'pro_plus', at: new Date(now.getTime() - 10 * 60 * 1000) },
    quota: { initiations: [], translations: [], media: [] },
    streak: { current: 0, longest: 0, lastQualifiedDay: null },
    stats: { lastActiveAt: now, messagesSent: 0 },
    createdAt: now,
    updatedAt: now,
  })

  const sender = createEmailSender(env, console)
  const senders = {
    email: sender,
    push: { send: () => Promise.resolve({ invalidTokens: [] }) },
    logger: { error: (obj: object, msg: string) => console.error(msg, obj) },
  }

  console.log(`db          ${DB}`)
  console.log(`to          ${address}`)
  console.log(`deliverable ${sender.deliverable}\n`)

  console.log('churned 10 minutes ago — the renewal could still arrive')
  console.log('  →', JSON.stringify(await runPlanEndedPass(db, senders)))

  await db
    .collection<Profile>(COLLECTIONS.profiles)
    .updateOne(
      { _id: userId },
      { $set: { 'churnedFrom.at': new Date(Date.now() - PLAN_ENDED_DELAY_MS - 60_000) } },
    )

  console.log('\nchurned 31 minutes ago — it did not')
  console.log('  →', JSON.stringify(await runPlanEndedPass(db, senders)))

  console.log('\nthe same tick again — the ledger has it')
  console.log('  →', JSON.stringify(await runPlanEndedPass(db, senders)))

  const claims = await db.collection(COLLECTIONS.notificationLedger).find({}).toArray()
  console.log(
    '\nledger',
    claims.map((c) => c._id),
  )
} finally {
  await db.dropDatabase()
  await client.close()
}
