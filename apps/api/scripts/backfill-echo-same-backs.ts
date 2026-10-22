/**
 * Empties the back of every kept card whose back is just its front again.
 *
 * A capture asked for the sentence's meaning in the reader's language, and
 * for a sentence already in that language — a Turkish partner's message kept
 * by a Turkish reader — every source (the translation on screen, the cache,
 * the provider) hands the same sentence back. That was stored as the back, so
 * the card showed one line on both sides and a production review put the
 * answer on screen as the question. `backFor` now stores an empty back in that
 * case; this does the same for the cards made before it did.
 *
 * Only cards kept from a message or a post — the two captures whose back a
 * machine wrote. A hand-written card's back is what its author typed, and a
 * pack's is curated; neither is this script's to change.
 *
 * "The same" is `backAddsMeaning`, the rule the capture and the session use:
 * case, punctuation, spacing and accents set aside. An emptied back is filled
 * in the app, by the card's Edit.
 *
 * Usage:
 *   pnpm exec tsx --env-file=<env> scripts/backfill-echo-same-backs.ts
 *   pnpm exec tsx --env-file=<env> scripts/backfill-echo-same-backs.ts --apply
 */
import { backAddsMeaning } from '@langx/shared'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import type { EchoCardDoc } from '../src/modules/echo/documents'

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const env = loadEnv(process.env)
  const handle = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

  try {
    const cards = handle.db.collection<EchoCardDoc>(COLLECTIONS.echoCards)
    const ids: EchoCardDoc['_id'][] = []
    const samples: string[] = []
    for await (const card of cards.find(
      { sourceKey: /^(msg|post):/, back: { $ne: '' } },
      { projection: { front: 1, back: 1, sourceKey: 1 } },
    )) {
      if (backAddsMeaning(card.front, card.back)) continue
      ids.push(card._id)
      if (samples.length < 5) samples.push(`${card.sourceKey}: "${card.front}" / "${card.back}"`)
    }

    console.log(`${ids.length} card(s) whose back repeats the front.`)
    for (const line of samples) console.log(`  ${line}`)
    if (!apply) {
      console.log('Dry run. Pass --apply to write.')
      return
    }

    // In chunks, so a large environment does not build one enormous update.
    const CHUNK = 500
    let written = 0
    for (let at = 0; at < ids.length; at += CHUNK) {
      const result = await cards.updateMany(
        { _id: { $in: ids.slice(at, at + CHUNK) } },
        { $set: { back: '' } },
      )
      written += result.modifiedCount
    }
    console.log(`Emptied ${written} back(s).`)
  } finally {
    await handle.close()
  }
}

await main()
