/**
 * The one letter to somebody who opened an account and never finished the
 * wizard — and the reason it is a script of its own rather than a campaign.
 *
 * These people have no profile, so they have no
 * `settings.notifications.promotions.email`, so **none of them has consented
 * to anything**. `send-campaign.ts` cannot see them and must not; a Resend
 * audience built from them would be a marketing list assembled out of silence.
 * What is defensible is the narrow thing this does: one service message about
 * the account they themselves opened, saying how to finish it, sent once and
 * never again. `notificationLedger` is what makes "never again" true rather
 * than intended — the claim is keyed `onboardingReminder:<userId>:once`, so a
 * re-run, a second machine or a crash halfway cannot produce a second letter.
 *
 * Two letters, chosen per person by `reminderVariant`:
 *
 *   reminder  a confirmed address with no profile — the wizard is what is left
 *   confirm   an address nobody ever proved, which `requireEmailVerification`
 *             will not let sign in at all, so the wizard is not yet their step
 *
 * Both bodies must contain `{{unsubscribeUrl}}`, in the HTML and in any text
 * file — the same rule as `send-campaign.ts`, for the same reason.
 *
 * Usage (dry run prints the plan and sends nothing):
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env --env-file=../../.env.prod \
 *     scripts/send-onboarding-reminder.ts \
 *       --subject "Finish setting up your profile" --html-file ./reminder.html \
 *       --confirm-subject "Confirm your address to get in" --confirm-html-file ./confirm.html \
 *       [--text-file ./reminder.txt] [--confirm-text-file ./confirm.txt] \
 *       [--min-age-hours 24] [--limit 50] [--emails] [--confirm]
 *
 * Without `--confirm` it counts, prints and sends nothing. Without
 * RESEND_API_KEY the sender prints each message instead of sending it.
 */
import { readFileSync } from 'node:fs'
import { connectToDatabase } from '../src/db/client'
import { unsubscribeHeaders } from '../src/email/notify'
import { createEmailSender, EMAIL_BATCH_SIZE, type EmailMessage } from '../src/email/sender'
import { signUnsubscribeToken, unsubscribeUrl } from '../src/email/unsubscribeToken'
import { loadEnv, publicApiUrl, unsubscribeSecret } from '../src/env'
import { deriveTextBody, UNSUBSCRIBE_PLACEHOLDER } from '../src/modules/notifications/campaign'
import { claimOnce } from '../src/modules/notifications/ledger'
import {
  reminderCohort,
  type ReminderRecipient,
  type ReminderVariant,
} from '../src/modules/notifications/onboardingReminder'

/** Resend's default is two requests a second; this stays comfortably under. */
const BATCH_DELAY_MS = 700

/** One claim per person for all time — this letter has no second edition. */
const PERIOD_KEY = 'once'

interface Letter {
  subject: string
  html: string
  text: string
}

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

function mask(email: string): string {
  const [user = '', domain = ''] = email.split('@')
  return `${user.slice(0, 2)}***@${domain}`
}

/** A body with no way out of it is not sendable, whichever file it came from. */
function readBody(path: string, what: string): string {
  const body = readFileSync(path, 'utf8')
  if (!body.includes(UNSUBSCRIBE_PLACEHOLDER)) {
    throw new Error(
      `${what} must contain ${UNSUBSCRIBE_PLACEHOLDER} — refusing to send without one`,
    )
  }
  return body
}

function loadLetter(subject: string, htmlFile: string, textFile: string | undefined): Letter {
  const html = readBody(htmlFile, htmlFile)
  const text = textFile ? readBody(textFile, textFile) : deriveTextBody(html)
  return { subject, html, text }
}

async function main(): Promise<void> {
  const subject = flag('subject')
  const htmlFile = flag('html-file')
  const confirmSubject = flag('confirm-subject')
  const confirmHtmlFile = flag('confirm-html-file')
  const limit = flag('limit') ? Number(flag('limit')) : undefined
  const minAgeHours = flag('min-age-hours') ? Number(flag('min-age-hours')) : undefined
  const showEmails = process.argv.includes('--emails')
  const confirmed = process.argv.includes('--confirm')

  if (!subject || !htmlFile) throw new Error('--subject and --html-file are both required')

  const letters: Record<ReminderVariant, Letter | undefined> = {
    reminder: loadLetter(subject, htmlFile, flag('text-file')),
    confirm:
      confirmSubject && confirmHtmlFile
        ? loadLetter(confirmSubject, confirmHtmlFile, flag('confirm-text-file'))
        : undefined,
  }

  const env = loadEnv()
  const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

  try {
    const cohort = await reminderCohort(db, {
      ...(minAgeHours === undefined ? {} : { minAgeHours }),
      ...(limit === undefined ? {} : { limit }),
    })
    const counts = cohort.reduce<Record<string, number>>((acc, person) => {
      acc[person.variant] = (acc[person.variant] ?? 0) + 1
      return acc
    }, {})

    console.log(`onboarding reminder on ${env.MONGODB_DB}`)
    console.log(`  from: ${env.EMAIL_FROM}`)
    console.log(`  cohort: ${cohort.length}${limit ? ` (limit ${limit})` : ''}`)
    for (const [variant, n] of Object.entries(counts)) console.log(`    ${variant}: ${n}`)
    for (const person of cohort) {
      console.log(
        `    ${person.variant.padEnd(8)} ${showEmails ? person.email : mask(person.email)}`,
      )
    }

    /*
     * A cohort that needs a letter nobody supplied is a refusal, not a skip.
     * Quietly sending the wizard reminder to somebody who cannot sign in is
     * exactly the mistake the two variants exist to prevent.
     */
    const missing = cohort.find((person) => letters[person.variant] === undefined)
    if (missing) {
      throw new Error(
        `${counts[missing.variant]} recipient(s) need the "${missing.variant}" letter — ` +
          'pass --confirm-subject and --confirm-html-file, or --limit past them',
      )
    }

    if (!confirmed) {
      console.log('\n(dry run — re-run with --confirm to send)')
      return
    }
    if (!env.RESEND_API_KEY) {
      console.log('\nRESEND_API_KEY is not set — every message will be printed, not sent')
    }

    const sender = createEmailSender(env, console)
    const secret = unsubscribeSecret(env)
    const apiBaseUrl = publicApiUrl(env)

    let sent = 0
    let alreadySent = 0
    for (let index = 0; index < cohort.length; index += EMAIL_BATCH_SIZE) {
      const batch = cohort.slice(index, index + EMAIL_BATCH_SIZE)

      /*
       * Claimed before the send, one at a time, exactly as `ledger.ts` argues:
       * a send that then fails is one letter nobody got, where a send that
       * succeeded after an unrecorded claim is a second letter to somebody who
       * never asked for the first.
       */
      const claimed: ReminderRecipient[] = []
      for (const person of batch) {
        if (await claimOnce(db, 'onboardingReminder', person.userId, PERIOD_KEY)) {
          claimed.push(person)
        } else {
          alreadySent++
        }
      }
      if (claimed.length === 0) continue

      const messages: EmailMessage[] = claimed.map((person) => {
        const letter = letters[person.variant] as Letter
        const url = unsubscribeUrl(apiBaseUrl, signUnsubscribeToken(secret, person.userId, 'all'))
        return {
          to: person.email,
          subject: letter.subject,
          html: letter.html.replaceAll(UNSUBSCRIBE_PLACEHOLDER, url),
          text: letter.text.replaceAll(UNSUBSCRIBE_PLACEHOLDER, url),
          headers: unsubscribeHeaders(url),
        }
      })

      if (sender.sendBatch) await sender.sendBatch(messages)
      else for (const message of messages) await sender.send(message)
      sent += messages.length

      if (index + EMAIL_BATCH_SIZE < cohort.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS))
      }
    }

    console.log(
      `\nsent ${sent}${alreadySent > 0 ? `, skipped ${alreadySent} already written to` : ''}`,
    )
  } finally {
    await close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
