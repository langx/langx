/**
 * Sends the @langx welcome-back to the v1 people who have already come back —
 * the backfill behind `modules/official/welcomeBack.ts`, which from now on
 * says it as they arrive.
 *
 * They got nothing when they returned. `routes/profiles.ts` skipped the
 * ordinary hello for them on the grounds that the welcome-back screen said
 * more, and the message that should have taken its place did not exist yet.
 *
 * **Come back** means a profile: a `precreatedFromV1` row on its own is an
 * account the script opened and nobody has ever opened since, with no
 * languages to write in and nobody to read it. Those 3,000-odd are the email
 * win-back's population, not this one's — see `audiencePlan(db, 'v1')`.
 *
 * Safe to re-run, and safe to race the live paths: `sendWelcomeBackMessage`
 * stamps `welcomeback:<userId>`, and `messages.sender_client_id_unique`
 * refuses the second write in the database rather than in a flag.
 *
 *   cd apps/api
 *   pnpm exec tsx --env-file=../../.env scripts/send-welcome-back.ts            # report only
 *   pnpm exec tsx --env-file=../../.env scripts/send-welcome-back.ts --apply    # send
 *
 * Against production add `--env-file=../../.env --env-file=../../.env.prod`
 * before the script path — the overlay is what makes touching production an
 * explicit extra flag. `cd` into `apps/api` first either way: `pnpm --filter`
 * resolves a relative `--env-file` against the wrong directory.
 */
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv, publicApiUrl } from '../src/env'
import type { Message } from '../src/modules/chat/conversations'
import { ensureOfficialAccounts } from '../src/modules/official/accounts'
import { sendWelcomeBackMessage } from '../src/modules/official/welcomeBack'
import type { Profile } from '../src/modules/profiles/profiles'

const apply = process.argv.includes('--apply')
const env = loadEnv()
const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

try {
  // Fills the id cache `deliverOfficialMessage` reads. The API does this at
  // boot; a script is its own process and has had no boot.
  const accounts = await ensureOfficialAccounts(db, publicApiUrl(env))
  if (accounts.find((account) => account.handle === 'langx')?.outcome === 'conflict') {
    throw new Error('@langx is held by a real account — nothing to send from')
  }

  const cohort = await db
    .collection<{ _id: unknown }>(COLLECTIONS.user)
    .find({ precreatedFromV1: { $exists: true } }, { projection: { _id: 1 } })
    .toArray()
  // Better Auth stores ids as ObjectId and everything of ours stores the
  // string form; `profiles._id` is the string. See `lib/authId.ts`.
  const ids = cohort.map((row) => String(row._id))

  const profiles = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find({
      _id: { $in: ids },
      deletedAt: { $exists: false },
      guest: { $exists: false },
      // @langx itself was adopted from a v1 account, so it is in the cohort.
      official: { $exists: false },
    })
    .toArray()

  console.log(`db                       ${env.MONGODB_DB}`)
  console.log(`precreated from v1       ${ids.length}`)
  console.log(`of those, came back      ${profiles.length}`)

  const messages = db.collection<Message>(COLLECTIONS.messages)
  const pending: Profile[] = []
  for (const profile of profiles) {
    const already = await messages.countDocuments({ clientId: `welcomeback:${profile._id}` })
    if (already > 0) {
      console.log(`  @${profile.handle.padEnd(20)} already told`)
      continue
    }
    console.log(`  @${profile.handle.padEnd(20)} to tell`)
    pending.push(profile)
  }

  console.log(`\nto tell                  ${pending.length}`)
  if (!apply) {
    if (pending.length > 0) console.log('\nRe-run with --apply to send.')
  } else {
    let sent = 0
    for (const profile of pending) {
      /*
       * One person's failure is their own. This walks a few hundred accounts
       * and a single bad profile — one with no languages a catalogue answers
       * to, say — must not take the rest of the run with it.
       */
      try {
        await sendWelcomeBackMessage(db, profile._id)
        sent += 1
        console.log(`  @${profile.handle.padEnd(20)} told`)
      } catch (error) {
        console.error(`  @${profile.handle.padEnd(20)} failed`, error)
      }
    }
    console.log(`sent                     ${sent}`)
  }
} finally {
  await close()
}
