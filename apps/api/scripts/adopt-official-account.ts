/**
 * Turns an account that has been run by hand into the official one.
 *
 * Run **once**, per handle, by a person. `ensureOfficialAccounts` refuses to
 * touch a profile it did not create — taking a handle off its owner is a data
 * loss no index would catch — so adopting one is a deliberate act with a
 * deliberate command behind it, not something a boot decides.
 *
 * It keeps everything the account is: its conversations, its messages, its
 * photos, its history. It takes away the ability to sign in, because that is a
 * property of every official account and this one does not get to be an
 * exception. The old address comes free in the process, which for a support
 * mailbox is the point.
 *
 * Afterwards the next boot writes the display name, the avatar and the bio
 * from code — those three are code-owned precisely because no screen can edit
 * an account nobody can sign in to.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env scripts/adopt-official-account.ts --handle langx
 *
 *   # production, which is where this is actually for
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env --env-file=../../.env.prod \
 *     scripts/adopt-official-account.ts --handle langx --confirm
 *
 * Without `--confirm` it prints what it would do and changes nothing.
 */
import { isOfficialHandle, type OfficialHandle } from '@langx/shared'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import { authId } from '../src/lib/authId'
import { adoptOfficialAccount } from '../src/modules/official/adopt'
import type { Profile } from '../src/modules/profiles/profiles'

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

function has(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

async function main(): Promise<void> {
  const handle = flag('handle')
  if (!handle || !isOfficialHandle(handle)) {
    throw new Error('usage: --handle <langx|copilot> [--confirm]')
  }
  const official: OfficialHandle = handle

  const env = loadEnv()
  const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

  try {
    const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ handle: official })
    if (!profile) {
      console.log(
        `@${official} is free on ${env.MONGODB_DB} — the next boot creates it. Nothing to adopt.`,
      )
      return
    }
    if (profile.official) {
      console.log(`@${official} is already the official account. Nothing to do.`)
      return
    }

    const id = authId(profile._id)
    const user = await db
      .collection<{ email?: string }>(COLLECTIONS.user)
      .findOne({ _id: id }, { projection: { email: 1 } })
    const [sessions, credentials, conversations, messages] = await Promise.all([
      db.collection(COLLECTIONS.session).countDocuments({ userId: id }),
      db.collection(COLLECTIONS.account).countDocuments({ userId: id }),
      db.collection(COLLECTIONS.conversations).countDocuments({ participants: profile._id }),
      db.collection(COLLECTIONS.messages).countDocuments({ senderId: profile._id }),
    ])

    console.log(`adopting @${official} on ${env.MONGODB_DB}`)
    console.log(`  account:        ${profile._id} (${profile.displayName})`)
    console.log(`  address:        ${user?.email ?? '(none)'} → ${official}@official.langx.invalid`)
    console.log(
      `  sign-in:        ${String(sessions)} session(s) and ${String(credentials)} credential(s) will be removed`,
    )
    console.log(
      `  kept:           ${String(conversations)} conversation(s), ${String(messages)} message(s), ${String(profile.photos?.length ?? 0)} photo(s)`,
    )
    console.log(`  overwritten:    display name and bio, from code, on the next boot`)
    console.log(`  cleared:        the language lists, so it matches a created official account`)

    // Dry run by default, on every database and not just a live one: this
    // revokes somebody's sign-in, which is not a thing to do by forgetting a
    // flag.
    if (!has('confirm')) {
      console.log('\n(dry run — re-run with --confirm to do it)')
      return
    }

    const result = await adoptOfficialAccount(db, official)
    console.log(
      `\ndone. ${String(result.sessionsRevoked)} session(s) and ${String(result.credentialsRemoved)} credential(s) revoked;` +
        ` ${result.previousEmail ?? 'the address'} is free again.`,
    )
    console.log('Restart the API (or deploy) to have it take its name, avatar and bio.')
  } finally {
    await close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
