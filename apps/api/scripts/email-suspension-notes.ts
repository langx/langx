/**
 * Mails the @langx notes already sent to the accounts suspended this past
 * week — once, as a backfill for the panel's "Send + email".
 *
 * A note to somebody we then suspend is written into a thread they cannot
 * open: every route but the suspension screen refuses them, and the push it
 * made is gone once dismissed. Until the panel could mail a note, there was no
 * other way for those words to reach them before the suspension ends.
 *
 * Who: profiles suspended in the last `--days` (default 7) and still
 * suspended now — somebody already lifted can open the app and read the
 * thread. What: the notes an operator wrote to them from @langx — the panel's
 * message (`admin:` clientId) and a report's warning (`reportWarning:`) —
 * from a day before the suspension onwards, so the note written just before
 * suspending is included. Broadcasts and the welcome are not notes and are
 * left alone.
 *
 * Safe to re-run. Each note is claimed in `notificationLedger` as
 * `officialNoteEmail:<userId>:<messageId>` before it is sent — the same claim
 * the panel makes — so nothing is mailed twice, whichever sent it first. Only
 * a verified address is written to.
 *
 *   pnpm --filter @langx/api exec tsx scripts/email-suspension-notes.ts           # report only
 *   pnpm --filter @langx/api exec tsx scripts/email-suspension-notes.ts --apply   # send
 *
 * Against production, add `--env-file=../../.env --env-file=../../.env.prod`
 * before the script path — the overlay is what makes touching production an
 * explicit extra flag.
 */
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { createEmailSender } from '../src/email/sender'
import { loadEnv } from '../src/env'
import type { Conversation, Message } from '../src/modules/chat/conversations'
import { notSuspended } from '../src/modules/moderation/suspension'
import { alreadyClaimed } from '../src/modules/notifications/ledger'
import { emailOfficialNote } from '../src/modules/official/noteEmail'
import { emailFor } from '../src/modules/profiles/emailFor'
import type { Profile } from '../src/modules/profiles/profiles'

const DAY_MS = 24 * 60 * 60 * 1000

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? undefined : process.argv[i + 1]
}

const apply = process.argv.includes('--apply')
const days = Number(arg('days') ?? 7)
if (!Number.isInteger(days) || days < 1) throw new Error('--days must be a whole number ≥ 1')

const env = loadEnv()
const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

try {
  const now = new Date()
  const since = new Date(now.getTime() - days * DAY_MS)
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)

  const langx = await profiles.findOne(
    { handle: 'langx', official: true },
    { projection: { _id: 1 } },
  )
  if (!langx) throw new Error('there is no official @langx account to have sent anything')

  const suspended = await profiles
    .find(
      {
        'suspension.at': { $gte: since },
        // Still in force — the inverse of the fragment every visible read uses.
        $nor: [notSuspended(now)],
      },
      { projection: { handle: 1, suspension: 1 } },
    )
    .toArray()

  console.log(`db                        ${env.MONGODB_DB}`)
  console.log(`suspended in last ${String(days).padEnd(2)} days  ${suspended.length}`)

  const pending: { profile: Profile; message: Message }[] = []
  for (const profile of suspended) {
    const conversations = await db
      .collection<Conversation>(COLLECTIONS.conversations)
      .find({ participants: { $all: [langx._id, profile._id] } }, { projection: { _id: 1 } })
      .toArray()
    const notes = await db
      .collection<Message>(COLLECTIONS.messages)
      .find({
        conversationId: { $in: conversations.map((c) => c._id) },
        senderId: langx._id,
        clientId: { $regex: /^(admin|reportWarning):/ },
        createdAt: { $gte: new Date(new Date(profile.suspension!.at).getTime() - DAY_MS) },
        deletedAt: { $exists: false },
      })
      .sort({ createdAt: 1 })
      .toArray()

    const address = await emailFor(db, profile._id)
    if (notes.length === 0) {
      console.log(`  @${profile.handle.padEnd(20)} no note`)
      continue
    }
    if (!address?.verified) {
      console.log(`  @${profile.handle.padEnd(20)} ${notes.length} note(s), no verified address`)
      continue
    }
    for (const message of notes) {
      const id = message._id.toHexString()
      if (await alreadyClaimed(db, 'officialNoteEmail', profile._id, id)) {
        console.log(`  @${profile.handle.padEnd(20)} ${id} already mailed`)
        continue
      }
      const preview = message.body.replace(/\s+/g, ' ').slice(0, 70)
      console.log(
        `  @${profile.handle.padEnd(20)} ${message.createdAt.toISOString().slice(0, 16)}  “${preview}”`,
      )
      pending.push({ profile, message })
    }
  }

  console.log(`\nto mail                   ${pending.length}`)
  if (!apply) {
    if (pending.length > 0) console.log('\nRe-run with --apply to send.')
  } else {
    const sender = createEmailSender(env, console)
    let sent = 0
    for (const { profile, message } of pending) {
      try {
        const outcome = await emailOfficialNote(db, sender, {
          userId: profile._id,
          messageId: message._id.toHexString(),
          body: message.body,
        })
        if (outcome === 'sent') sent += 1
        console.log(`  @${profile.handle.padEnd(20)} ${outcome}`)
      } catch (error) {
        console.error(`  @${profile.handle} failed`, error)
      }
    }
    console.log(`sent                      ${sent}`)
  }
} finally {
  await close()
}
