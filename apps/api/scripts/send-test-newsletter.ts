/**
 * Sends one member's monthly letter to a test address — their real numbers,
 * the real template and that month's editorial note — so a letter can be read
 * in an inbox before the first of the month sends it to everybody.
 *
 * Reads only. Nothing is claimed and nothing is written, so the member's own
 * letter still goes on the first as it would have; the subject is marked
 * `[TEST]` and the unsubscribe link points at Settings rather than carrying
 * the member's token.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env \
 *     scripts/send-test-newsletter.ts --handle xue --to you@example.com [--month 2026-09]
 *
 * `--month` defaults to the month before this one, which is the one the next
 * pass will send.
 */
import { connectToDatabase } from '../src/db/client'
import { ResendEmailSender } from '../src/email/sender'
import { newsletterEmail } from '../src/email/templates'
import { noteFor } from '../src/email/newsletters'
import {
  communityMonth,
  lastMonthKey,
  personalMonth,
  type MonthlyRecap,
} from '../src/modules/notifications/newsletter'
import { findProfileByHandleOrId } from '../src/modules/profiles/profiles'
import { localeFor } from '../src/modules/profiles/localeFor'

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

const handleArg = arg('handle')
const to = arg('to')
const month = arg('month') ?? lastMonthKey(new Date())
if (!handleArg || !to) {
  console.error('Usage: send-test-newsletter.ts --handle <handle> --to <email> [--month YYYY-MM]')
  process.exit(1)
}
const { MONGODB_URI, MONGODB_DB, RESEND_API_KEY, EMAIL_FROM } = process.env
if (!MONGODB_URI || !MONGODB_DB || !RESEND_API_KEY || !EMAIL_FROM) {
  console.error('MONGODB_URI, MONGODB_DB, RESEND_API_KEY and EMAIL_FROM must be set')
  process.exit(1)
}

const handle = await connectToDatabase(MONGODB_URI, MONGODB_DB)
try {
  const profile = await findProfileByHandleOrId(handle.db, handleArg)
  if (!profile) throw new Error(`No profile answers to ${handleArg}`)
  const [personal, community, locale] = await Promise.all([
    personalMonth(handle.db, profile._id, month),
    communityMonth(handle.db, month),
    localeFor(handle.db, profile._id),
  ])
  // The same test `runNewsletterPass` makes, so the test letter is the one
  // the member would get.
  const recap: MonthlyRecap = {
    month,
    personal,
    community,
    quiet:
      personal.messages === 0 &&
      personal.corrections === 0 &&
      personal.posts === 0 &&
      personal.tokens === 0,
  }
  const mail = newsletterEmail(
    locale,
    recap,
    noteFor(month, locale),
    'https://app.langx.io/settings',
  )
  await new ResendEmailSender(RESEND_API_KEY, EMAIL_FROM).send({
    to,
    ...mail,
    subject: `[TEST] ${mail.subject}`,
  })
  console.log(`Sent @${profile.handle}'s ${month} letter (${locale}) to ${to}`)
} finally {
  await handle.close()
}
