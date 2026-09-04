/**
 * Pushes this database's mailing consent onto a Resend audience.
 *
 * The audience is a **projection**, never the record: `src/modules/
 * notifications/audience.ts` recomputes the whole answer from Mongo on every
 * run, so a switch turned off, an address newly verified or an account deleted
 * is corrected on the next sync rather than drifting quietly apart. Nothing
 * here reads Resend to decide anything.
 *
 * Why it exists at all, given that `send-campaign.ts` mails straight from
 * Mongo and needs no list: a broadcast written in Resend's own editor needs an
 * audience to point at. That is the whole gain, and it is worth naming the
 * cost — one more copy of the addresses, and an unsubscribe pressed inside a
 * broadcast that this database will not hear about until a webhook writes it
 * back. Until that webhook exists, a Resend-side unsubscribe is corrected by
 * nothing, so this never resubscribes anybody: `subscribe` is written only for
 * somebody read as consenting, never as a repair pass.
 *
 * **`--source` is the consent decision, and it is the only one here.**
 *
 *   consented  `promotions.email` is true in this database. Self-evident, and
 *              the same people `send-campaign.ts` would mail.
 *   v1         those, plus every `precreatedFromV1` row that has not since
 *              said no — the claim being that v1's sign-up took the consent
 *              and v2 simply has no record of it. That claim is not checked
 *              here; it is asserted by whoever types the flag.
 *   all        plus everybody else with a verified address. Nobody said yes.
 *
 * An explicit refusal always wins, whatever the source: it goes up as
 * `unsubscribed`, because Resend keeps a suppression and a later run cannot
 * then undo it by accident. A deleted account is removed outright.
 *
 * Usage (dry run prints a plan and writes nothing):
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env --env-file=../../.env.prod \
 *     scripts/sync-resend-audience.ts --audience <id> [--source v1] [--limit 50] [--confirm]
 */
import { Resend } from 'resend'
import { connectToDatabase } from '../src/db/client'
import { loadEnv } from '../src/env'
import {
  audiencePlan,
  type AudienceContact,
  type AudienceSource,
} from '../src/modules/notifications/audience'

/** Resend's default is two requests a second; contacts go up one at a time. */
const REQUEST_DELAY_MS = 600
/** How often a long run says where it is. */
const PROGRESS_EVERY = 100

const SOURCES: AudienceSource[] = ['consented', 'v1', 'all']

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

function mask(email: string): string {
  const [user = '', domain = ''] = email.split('@')
  return `${user.slice(0, 2)}***@${domain}`
}

function isAlreadyExists(message: string): boolean {
  return /already exists/i.test(message)
}

/** One contact, brought to the state Mongo says it should be in. */
async function apply(
  resend: Resend,
  audienceId: string,
  contact: AudienceContact,
): Promise<'ok' | 'missing'> {
  if (contact.action === 'remove') {
    const { error } = await resend.contacts.remove({ audienceId, email: contact.email })
    // Never on the list in the first place is the state we wanted.
    if (error && !/not found/i.test(error.message)) throw new Error(error.message)
    return 'ok'
  }

  const unsubscribed = contact.action === 'unsubscribe'
  const { error } = await resend.contacts.create({
    audienceId,
    email: contact.email,
    ...(contact.name ? { firstName: contact.name } : {}),
    unsubscribed,
  })
  if (!error) return 'ok'
  if (!isAlreadyExists(error.message)) throw new Error(error.message)

  /*
   * Already there, so this run is a correction rather than an addition — and
   * only ever downwards. Re-subscribing an existing contact would overwrite an
   * unsubscribe pressed inside a Resend broadcast, which is the one piece of
   * state this database cannot see; leaving it alone is what keeps the
   * missing webhook from turning into a mail somebody asked not to get.
   */
  if (!unsubscribed) return 'missing'
  const updated = await resend.contacts.update({ audienceId, email: contact.email, unsubscribed })
  if (updated.error) throw new Error(updated.error.message)
  return 'ok'
}

async function main(): Promise<void> {
  const audienceId = flag('audience')
  const source = (flag('source') ?? 'consented') as AudienceSource
  const limit = flag('limit') ? Number(flag('limit')) : undefined
  const confirm = process.argv.includes('--confirm')

  // Required to write, not to count: the plan is read entirely from Mongo, so
  // a dry run has nothing to point at yet — and asking for the id before
  // anybody has seen the numbers gets the order of the decision backwards.
  if (!audienceId && confirm) {
    throw new Error(
      '--audience <id> is required to write — name the audience explicitly rather than defaulting to the newsletter one',
    )
  }
  if (!SOURCES.includes(source)) {
    throw new Error(`--source must be one of ${SOURCES.join(', ')}`)
  }

  const env = loadEnv()
  const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

  try {
    const plan = await audiencePlan(db, source, { ...(limit ? { limit } : {}) })
    const counts = { subscribe: 0, unsubscribe: 0, remove: 0 }
    for (const contact of plan.contacts) counts[contact.action]++

    console.log(`audience ${audienceId ?? '(none yet)'} ← ${env.MONGODB_DB} (source: ${source})`)
    console.log(`  subscribe: ${counts.subscribe}`)
    console.log(`  unsubscribe: ${counts.unsubscribe}`)
    console.log(`  remove: ${counts.remove}`)
    console.log(`  skipped: ${JSON.stringify(plan.skipped)}`)
    for (const contact of plan.contacts.slice(0, 5)) {
      console.log(`    ${contact.action} ${mask(contact.email)}`)
    }
    if (plan.contacts.length > 5) console.log(`    …and ${plan.contacts.length - 5} more`)

    if (!confirm) {
      console.log('\n(dry run — re-run with --confirm to write to Resend)')
      return
    }
    if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set — nothing to write with')
    if (!audienceId) throw new Error('--audience <id> is required to write')

    const resend = new Resend(env.RESEND_API_KEY)
    let done = 0
    let untouched = 0
    for (const contact of plan.contacts) {
      const outcome = await apply(resend, audienceId, contact)
      if (outcome === 'missing') untouched++
      done++
      if (done % PROGRESS_EVERY === 0) console.log(`  …${done}/${plan.contacts.length}`)
      if (done < plan.contacts.length) {
        await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS))
      }
    }

    console.log(`\nwrote ${done - untouched}`)
    if (untouched > 0) {
      console.log(`left alone ${untouched} already on the list — their Resend state is theirs`)
    }
  } finally {
    await close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
