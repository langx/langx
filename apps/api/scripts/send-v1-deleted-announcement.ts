/**
 * The one email to the v1 accounts their owners deleted — the addresses
 * `scripts/precreate-v1-users.ts` set aside in `v1DeletedContacts` — and the
 * end of that collection.
 *
 * These people ended their relationship with the product once, so this is
 * held to a stricter standard than a campaign: it goes out **once**, it
 * carries an unsubscribe that forgets the address on the spot, and `--drop`
 * removes the collection when everyone has been sent to. Nothing else reads
 * or writes those rows. See `docs/decisions.md` → _Every v1 account has a v2
 * `user` row_.
 *
 * Every row is claimed (`sentAt`) before its batch goes out, so a re-run
 * after a crash retries exactly the people who were not sent to and nobody
 * else. A batch that fails releases its own claim.
 *
 * The HTML must contain `{{unsubscribeUrl}}`, and so must a `--text-file` if
 * one is given — the same rule as `send-campaign.ts`, for the same reason.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env --env-file=../../.env.prod \
 *     scripts/send-v1-deleted-announcement.ts \
 *     --subject "LangX is back" --html-file ./announcement.html \
 *     [--text-file ./announcement.txt] [--limit 50] [--confirm] [--drop]
 *
 * Without `--confirm` it counts, prints and sends nothing. Without
 * RESEND_API_KEY it prints each message instead of sending it. `--drop` is
 * refused while anybody is still unsent, and can be run alone later.
 */
import { readFileSync } from 'node:fs'
import { connectToDatabase } from '../src/db/client'
import { unsubscribeHeaders } from '../src/email/notify'
import { createEmailSender, EMAIL_BATCH_SIZE, type EmailMessage } from '../src/email/sender'
import { signUnsubscribeToken, unsubscribeUrl } from '../src/email/unsubscribeToken'
import { loadEnv, publicApiUrl, unsubscribeSecret } from '../src/env'
import { deriveTextBody, UNSUBSCRIBE_PLACEHOLDER } from '../src/modules/notifications/campaign'
import {
  claimDeletedContacts,
  dropDeletedContacts,
  pendingDeletedContacts,
  releaseDeletedContacts,
} from '../src/modules/notifications/v1DeletedContacts'

/** Resend's default is two requests a second; this stays comfortably under. */
const BATCH_DELAY_MS = 700

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

function mask(email: string): string {
  const [user = '', domain = ''] = email.split('@')
  return `${user.slice(0, 2)}***@${domain}`
}

async function main(): Promise<void> {
  const subject = flag('subject')
  const htmlFile = flag('html-file')
  const textFile = flag('text-file')
  const limit = flag('limit') ? Number(flag('limit')) : undefined
  const confirm = process.argv.includes('--confirm')
  const drop = process.argv.includes('--drop')

  const env = loadEnv()
  const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

  try {
    // `--drop` on its own: the send already happened, this is the tidy-up.
    if (drop && !subject && !htmlFile) {
      await finish(db)
      return
    }

    if (!subject || !htmlFile) throw new Error('--subject and --html-file are both required')

    const html = readFileSync(htmlFile, 'utf8')
    if (!html.includes(UNSUBSCRIBE_PLACEHOLDER)) {
      throw new Error(
        `the html body must contain ${UNSUBSCRIBE_PLACEHOLDER} — refusing to send without one`,
      )
    }
    let text: string
    if (textFile) {
      text = readFileSync(textFile, 'utf8')
      if (!text.includes(UNSUBSCRIBE_PLACEHOLDER)) {
        throw new Error(
          `the text body must contain ${UNSUBSCRIBE_PLACEHOLDER} — refusing to send without one`,
        )
      }
    } else {
      text = deriveTextBody(html)
    }

    const sender = createEmailSender(env, console)
    const secret = unsubscribeSecret(env)
    const apiBaseUrl = publicApiUrl(env)

    const recipients = await pendingDeletedContacts(db, limit)
    console.log(`v1 deleted-account announcement on ${env.MONGODB_DB}`)
    console.log(`  unsent recipients: ${recipients.length}${limit ? ` (limit ${limit})` : ''}`)
    for (const recipient of recipients.slice(0, 5)) console.log(`    ${mask(recipient.email)}`)
    if (recipients.length > 5) console.log(`    …and ${recipients.length - 5} more`)

    if (!confirm) {
      console.log('\n(dry run — re-run with --confirm to send)')
      return
    }
    if (!env.RESEND_API_KEY) {
      console.log('\nRESEND_API_KEY is not set — every message will be printed, not sent')
    }

    let sent = 0
    for (let index = 0; index < recipients.length; index += EMAIL_BATCH_SIZE) {
      const batch = recipients.slice(index, index + EMAIL_BATCH_SIZE)
      const claimed = new Set(
        await claimDeletedContacts(
          db,
          batch.map((recipient) => recipient._id),
        ),
      )
      const messages: EmailMessage[] = batch
        .filter((recipient) => claimed.has(recipient._id))
        .map((recipient) => {
          const url = unsubscribeUrl(
            apiBaseUrl,
            signUnsubscribeToken(secret, recipient._id, 'v1contact'),
          )
          return {
            to: recipient.email,
            subject,
            html: html.replaceAll(UNSUBSCRIBE_PLACEHOLDER, url),
            text: text.replaceAll(UNSUBSCRIBE_PLACEHOLDER, url),
            headers: unsubscribeHeaders(url),
          }
        })
      if (messages.length === 0) continue

      try {
        if (sender.sendBatch) await sender.sendBatch(messages)
        else for (const message of messages) await sender.send(message)
        sent += messages.length
      } catch (error) {
        await releaseDeletedContacts(db, [...claimed])
        throw error
      }

      if (index + EMAIL_BATCH_SIZE < recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
      }
    }

    console.log(`\nsent ${sent}`)
    if (drop) await finish(db)
  } finally {
    await close()
  }
}

async function finish(db: Parameters<typeof dropDeletedContacts>[0]): Promise<void> {
  const outcome = await dropDeletedContacts(db)
  if (outcome.dropped) console.log('v1DeletedContacts dropped — nothing of these addresses remains')
  else console.log(`not dropped: ${outcome.unsent} still unsent — send to them first`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
