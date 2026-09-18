/**
 * Gives the cue picture to pack cards that were made before there were any.
 *
 * `startPack` copies the cue onto a card at the moment the card is made, which
 * is right — a card is a copy, and it belongs to whoever made it. It also means
 * every pack card in existence before this shipped has no picture and will
 * never get one, because nothing re-reads the pack after the copy.
 *
 * So: one pass, matching each card back to the pack item its `sourceKey` names,
 * and writing the picture the item now carries.
 *
 * **It never touches a picture that is somebody's own.** `origin: 'self'` is a
 * file they attached and `origin: 'chat'` is the picture the sentence arrived
 * with — a better cue than any of ours, and not ours to replace. Only two
 * cases are written: a card with no picture at all, and a card whose
 * `origin: 'pack'` picture is no longer the URL the pack item names. The
 * second is what makes a re-render safe to deploy; without it a cue that moved
 * leaves every existing card pointing at an object that is no longer there.
 *
 * Usage:
 *   pnpm exec tsx --env-file=<env> scripts/backfill-echo-cues.ts
 *   pnpm exec tsx --env-file=<env> scripts/backfill-echo-cues.ts --apply
 */
import type { EchoImage } from '@langx/shared'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import type { EchoCardDoc } from '../src/modules/echo/documents'
import type { EchoPackItemDoc } from '../src/modules/echo/packs'

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const env = loadEnv(process.env)
  const handle = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

  try {
    const items = handle.db.collection<EchoPackItemDoc>(COLLECTIONS.echoPackItems)
    const cards = handle.db.collection<EchoCardDoc>(COLLECTIONS.echoCards)

    /*
     * The whole item table in memory, which is fine at this size — three packs
     * of under three hundred — and is what lets the card pass below be one
     * cursor rather than a lookup per card.
     */
    const cueOf = new Map<string, string>()
    for await (const item of items.find({ image: { $exists: true } })) {
      if (item.image) cueOf.set(item._id, item.image)
    }
    console.log(`${cueOf.size} pack item(s) carry a cue.`)
    if (cueOf.size === 0) {
      console.log('Nothing to copy. Seed the packs first.')
      return
    }

    let empty = 0
    let stale = 0
    let missing = 0
    const writes: { id: EchoCardDoc['_id']; image: EchoImage }[] = []
    const query = {
      sourceKey: /^pack:/,
      $or: [{ image: { $exists: false } }, { 'image.origin': 'pack' }],
    }
    for await (const card of cards.find(query)) {
      const cue = cueOf.get(card.sourceKey.slice('pack:'.length))
      if (!cue) {
        // A card from an item the content has since dropped. Left as it is:
        // the card belongs to the person who made it, cue or no cue.
        missing += 1
        continue
      }
      if (card.image?.url === cue) continue
      if (card.image) stale += 1
      else empty += 1
      writes.push({ id: card._id, image: { url: cue, width: 400, height: 300, origin: 'pack' } })
    }

    console.log(`${writes.length} card(s) to write: ${empty} with no picture, ${stale} stale.`)
    if (missing > 0) console.log(`  ${missing} point at an item the packs no longer have.`)
    if (!apply) {
      console.log('Dry run. Pass --apply to write.')
      return
    }

    // In chunks, so a large environment does not build one enormous bulkWrite.
    const CHUNK = 500
    let written = 0
    for (let at = 0; at < writes.length; at += CHUNK) {
      const batch = writes.slice(at, at + CHUNK)
      const result = await cards.bulkWrite(
        batch.map((write) => ({
          updateOne: { filter: { _id: write.id }, update: { $set: { image: write.image } } },
        })),
      )
      written += result.modifiedCount
    }
    console.log(`Wrote ${written} card(s).`)
  } finally {
    await handle.close()
  }
}

await main()
