/**
 * Sends one message from @langx to everybody, as a message in their chat list.
 *
 * Not an email and not a push-only broadcast: an announcement lands in the
 * same thread the welcome did, so it is still there next week and can be
 * replied to. The push is only the knock on the door — `send-campaign.ts` is
 * the tool for something that has to arrive in an inbox, and it carries the
 * consent rules and the warm-up ramp that mail needs.
 *
 * **Nobody is messaged twice.** `messages.sender_client_id_unique` refuses a
 * second write with the same `announcement:<slug>` id, so a run that died
 * halfway can simply be run again — there is no cursor to keep and no ledger
 * to reconcile.
 *
 * The body is one file per locale in a directory, and each recipient gets the
 * one for their native language (`localeFor`), falling back to `en.txt`. Not
 * the server catalogue: an announcement is written once for one occasion, and
 * putting it in a typed catalogue would mean a code change and a deploy for
 * every sentence anybody wants to say.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env \
 *     scripts/send-announcement.ts --id 2026-09-copilot --body announcements/copilot [--confirm]
 *
 * Without `--confirm` it counts and prints and sends nothing.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SUPPORTED_LOCALES, type Locale } from '@langx/shared'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv, publicApiUrl } from '../src/env'
import { deliverOfficialMessage } from '../src/modules/official/deliver'
import { ensureOfficialAccounts } from '../src/modules/official/accounts'
import { localeFor } from '../src/modules/profiles/localeFor'
import type { Profile } from '../src/modules/profiles/profiles'
import { ExpoPushSender, sendPush, tokensFor } from '../src/modules/push/devices'

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

function has(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

/** `<dir>/<locale>.txt`, or English. A missing English file is fatal. */
function loadBodies(dir: string): Map<Locale, string> {
  const bodies = new Map<Locale, string>()
  for (const locale of SUPPORTED_LOCALES) {
    const path = join(dir, `${locale}.txt`)
    if (existsSync(path)) bodies.set(locale, readFileSync(path, 'utf8').trim())
  }
  if (!bodies.has('en')) throw new Error(`${dir}/en.txt is required — it is the fallback`)
  return bodies
}

async function main(): Promise<void> {
  const slug = flag('id')
  const dir = flag('body')
  if (!slug || !dir) {
    throw new Error('usage: --id <slug> --body <dir> [--confirm]')
  }

  /*
   * No separate refusal for a live database. There was one, and it fired
   * *before* the dry run — so the only way to preview an announcement against
   * production was to arm the send at the same time, which is the opposite of
   * what a preview is for. `--confirm` already gates every write; a second
   * gate on the same flag only took the safe path away.
   */
  const env = loadEnv()

  const bodies = loadBodies(dir)
  const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

  try {
    // Fills the id cache `deliverOfficialMessage` reads. The API does this at
    // boot; a script is its own process and has had no boot.
    const accounts = await ensureOfficialAccounts(db, publicApiUrl(env))
    if (accounts.find((a) => a.handle === 'langx')?.outcome === 'conflict') {
      throw new Error('@langx is held by a real account — nothing to send from')
    }

    const recipients = await db
      .collection<Profile>(COLLECTIONS.profiles)
      .find(
        { deletedAt: { $exists: false }, guest: { $exists: false }, official: { $exists: false } },
        { projection: { _id: 1 } },
      )
      .toArray()

    console.log(`announcement ${slug} on ${env.MONGODB_DB}`)
    console.log(`  recipients: ${recipients.length}`)
    console.log(`  locales: ${[...bodies.keys()].join(', ')}`)
    console.log(`\n  en.txt:\n${bodies.get('en')!.slice(0, 300)}\n`)

    if (!has('confirm')) {
      console.log('(dry run — re-run with --confirm to send it)')
      return
    }

    const push = new ExpoPushSender(env.EXPO_ACCESS_TOKEN)
    let sent = 0
    let failed = 0

    for (const recipient of recipients) {
      try {
        const locale = await localeFor(db, recipient._id)
        const body = bodies.get(locale) ?? bodies.get('en')!
        const delivered = await deliverOfficialMessage(db, {
          fromHandle: 'langx',
          toUserId: recipient._id,
          body,
          clientId: `announcement:${slug}`,
        })
        if (!delivered) continue
        sent += 1

        /*
         * The knock, not the message. No socket broadcast beside it: whoever
         * has the app open sees the thread on the next focus, and a script
         * outside the API process has no `io` to emit on anyway.
         *
         * **One language for both**, and it is the reader's native one, not
         * the phone's. `tokensByLocale` groups by device locale and is right
         * for a streak nudge — that is a sentence written for the screen it
         * appears on and nothing else. This one is a preview of a message
         * sitting in a thread, and a Turkish notification opening a Russian
         * message reads like two different senders. So the push follows
         * `localeFor`, like the message and the welcome before it.
         *
         * Best-effort — a phone that cannot be reached does not undo a message
         * that is already in the thread.
         */
        const tokens = await tokensFor(db, recipient._id)
        if (tokens.length > 0) {
          await sendPush(db, push, {
            to: tokens,
            title: 'LangX',
            // The same words as the message, in the same language.
            body: body.slice(0, 120),
            data: {
              kind: 'message',
              conversationId: delivered.conversation._id.toHexString(),
              senderId: delivered.message.senderId,
            },
          })
        }
      } catch (error) {
        failed += 1
        console.error(`  ${recipient._id}: ${String(error)}`)
      }
      if ((sent + failed) % 200 === 0) console.log(`  …${sent + failed}/${recipients.length}`)
    }

    console.log(`\nsent ${sent}, failed ${failed}. Re-running is safe: ${slug} is idempotent.`)
  } finally {
    await close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
