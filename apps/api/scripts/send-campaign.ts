/**
 * Sends one promotional email to everybody who asked for them.
 *
 * A script rather than a scheduled sender, because a campaign is a decision
 * somebody makes on a particular day about a particular message — there is
 * nothing to compute. And a script rather than Resend's own Audiences,
 * because that would keep a second copy of the addresses and their consent
 * outside this database: every deletion and every toggle would have to be
 * synchronised into it, and the day the two disagree is a complaint rather
 * than a bug.
 *
 * **Consent is read at send time**, from `settings.notifications.promotions`,
 * and it must be exactly true. Nothing here infers it.
 *
 * **A re-run cannot mail anybody twice.** Recipients are claimed into
 * `emailCampaigns` before the batch goes out, and the unique index on
 * `{campaignId, userId}` is what enforces it; a batch that fails releases its
 * own claim so the next run retries exactly those people.
 *
 * The HTML and text files must both contain `{{unsubscribeUrl}}`. The script
 * refuses to send otherwise — a promotional email without a way out is the one
 * mistake here with a regulator attached.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx scripts/send-campaign.ts \
 *     --campaign 2026-09-launch --subject "LangX v2 is here" \
 *     --html-file ./campaigns/launch.html [--text-file ./campaigns/launch.txt] \
 *     [--locale tr] [--limit 500] [--confirm]
 *
 * Without `--confirm` it counts and prints and sends nothing. Without
 * RESEND_API_KEY it prints each message instead of sending it, which is the
 * way to read one before it goes anywhere.
 */
import { readFileSync } from 'node:fs'
import { createEmailSender, EMAIL_BATCH_SIZE, type EmailMessage } from '../src/email/sender'
import { unsubscribeHeaders } from '../src/email/notify'
import { signUnsubscribeToken, unsubscribeUrl } from '../src/email/unsubscribeToken'
import { connectToDatabase } from '../src/db/client'
import { loadEnv, publicApiUrl, unsubscribeSecret } from '../src/env'
import {
  campaignRecipients,
  claimCampaignRecipients,
  releaseCampaignRecipients,
} from '../src/modules/notifications/campaign'

/** Resend's default is two requests a second; this stays comfortably under. */
const BATCH_DELAY_MS = 700

const PLACEHOLDER = '{{unsubscribeUrl}}'

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

function mask(email: string): string {
  const [user = '', domain = ''] = email.split('@')
  return `${user.slice(0, 2)}***@${domain}`
}

async function main(): Promise<void> {
  const campaignId = flag('campaign')
  const subject = flag('subject')
  const htmlFile = flag('html-file')
  const textFile = flag('text-file')
  const locale = flag('locale')
  const limit = flag('limit') ? Number(flag('limit')) : undefined
  const confirm = process.argv.includes('--confirm')

  if (!campaignId || !subject || !htmlFile) {
    throw new Error('--campaign, --subject and --html-file are all required')
  }

  const html = readFileSync(htmlFile, 'utf8')
  // Stripping tags rather than demanding a second file: a text part is
  // required by every deliverability guide, and one that is missing is a
  // worse default than one that is plain.
  const text = textFile
    ? readFileSync(textFile, 'utf8')
    : html
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

  for (const [name, body] of [
    ['html', html],
    ['text', text],
  ] as const) {
    if (!body.includes(PLACEHOLDER)) {
      throw new Error(`the ${name} body must contain ${PLACEHOLDER} — refusing to send without one`)
    }
  }

  const env = loadEnv()
  const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)
  const sender = createEmailSender(env, console)
  const secret = unsubscribeSecret(env)
  const apiBaseUrl = publicApiUrl(env)

  try {
    const audience = await campaignRecipients(db, campaignId, {
      ...(locale ? { locale } : {}),
      ...(limit ? { limit } : {}),
    })
    console.log(`campaign ${campaignId} on ${env.MONGODB_DB}`)
    console.log(`  recipients: ${audience.recipients.length}`)
    console.log(`  skipped: ${JSON.stringify(audience.skipped)}`)
    for (const recipient of audience.recipients.slice(0, 5)) {
      console.log(`    ${mask(recipient.email)} (${recipient.locale})`)
    }
    if (audience.recipients.length > 5)
      console.log(`    …and ${audience.recipients.length - 5} more`)

    if (!confirm) {
      console.log('\n(dry run — re-run with --confirm to send)')
      return
    }
    if (!env.RESEND_API_KEY) {
      console.log('\nRESEND_API_KEY is not set — every message will be printed, not sent')
    }

    let sent = 0
    for (let index = 0; index < audience.recipients.length; index += EMAIL_BATCH_SIZE) {
      const batch = audience.recipients.slice(index, index + EMAIL_BATCH_SIZE)
      const claimed = await claimCampaignRecipients(
        db,
        campaignId,
        batch.map((recipient) => recipient.userId),
      )
      const claimedSet = new Set(claimed)
      const messages: EmailMessage[] = batch
        .filter((recipient) => claimedSet.has(recipient.userId))
        .map((recipient) => {
          const url = unsubscribeUrl(
            apiBaseUrl,
            signUnsubscribeToken(secret, recipient.userId, 'promotions'),
          )
          return {
            to: recipient.email,
            subject,
            html: html.replaceAll(PLACEHOLDER, url),
            text: text.replaceAll(PLACEHOLDER, url),
            headers: unsubscribeHeaders(url),
          }
        })
      if (messages.length === 0) continue

      try {
        if (sender.sendBatch) await sender.sendBatch(messages)
        else for (const message of messages) await sender.send(message)
        sent += messages.length
      } catch (error) {
        // Release, so a re-run picks up exactly these people rather than
        // recording a send that never happened.
        await releaseCampaignRecipients(db, campaignId, claimed)
        throw error
      }

      if (index + EMAIL_BATCH_SIZE < audience.recipients.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
      }
    }

    console.log(`\nsent ${sent}`)
  } finally {
    await close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
