/**
 * Records the v1 sign-up's marketing consent in this database, so that the
 * app's own sender can see it.
 *
 * `promotions.email` is the one preference nothing infers: a stored default
 * cannot grant it and an older shape cannot imply it, which is why
 * `send-campaign.ts` today would mail none of the returning v1 accounts. This
 * writes the answer down rather than teaching the sender to guess — the rule
 * stays exactly as strict, and the record lands on the profile, where its
 * owner can see the switch and turn it off.
 *
 * **This writes consent on somebody's behalf.** Whoever runs it is asserting
 * that v1's sign-up took it. The assertion is recorded next to the flag, in
 * `promotionsConsent`, so the question has an answer later.
 *
 * Two things it refuses to do: it never touches an account that said no in
 * v2 — `audiencePlan` knows the difference between a refusal and a default
 * nobody was asked about — and it never writes to an account with no profile,
 * because a pre-created v1 row has nowhere to keep the answer until its owner
 * onboards. Both are counted.
 *
 * Usage (dry run counts and writes nothing):
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env --env-file=../../.env.prod \
 *     scripts/adopt-v1-consent.ts [--source v1] [--limit 50] [--confirm]
 */
import { connectToDatabase } from '../src/db/client'
import { loadEnv } from '../src/env'
import { adoptPromotionsConsent } from '../src/modules/notifications/adoptConsent'
import type { AudienceSource } from '../src/modules/notifications/audience'

const SOURCES: AudienceSource[] = ['consented', 'v1', 'all']

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

async function main(): Promise<void> {
  const source = (flag('source') ?? 'v1') as AudienceSource
  const limit = flag('limit') ? Number(flag('limit')) : undefined
  const confirm = process.argv.includes('--confirm')

  if (!SOURCES.includes(source)) throw new Error(`--source must be one of ${SOURCES.join(', ')}`)
  if (source === 'consented') {
    throw new Error('--source consented selects people who already said yes — nothing to record')
  }

  const env = loadEnv()
  const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

  try {
    const outcome = await adoptPromotionsConsent(db, source, {
      ...(limit ? { limit } : {}),
      apply: confirm,
    })
    console.log(`promotions.email ← ${source} consent, on ${env.MONGODB_DB}`)
    console.log(`  ${confirm ? 'written' : 'would write'}: ${outcome.updated.length}`)
    console.log(`  already recorded: ${outcome.alreadyRecorded}`)
    console.log(`  no profile yet: ${outcome.noProfile}`)
    console.log(`  said no, left alone: ${outcome.refused}`)
    if (!confirm) console.log('\n(dry run — re-run with --confirm to write)')
  } finally {
    await close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
