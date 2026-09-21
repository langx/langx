/**
 * Gives the pack's readings to pack cards that were made before there were any.
 *
 * `startPack` copies `voices` onto a card at the moment the card is made, which
 * is right — a card is a copy, and it belongs to whoever made it. It also means
 * every pack card made before the readings were generated is silent for ever,
 * because nothing re-reads the pack after the copy. `backfill-echo-cues.ts` is
 * this for the picture; the two are deliberately the same shape.
 *
 * **It checks that the item still holds the phrase the card was made from.**
 * A card's `sourceKey` is `pack:<packId>#<index>`, and the seed is idempotent
 * by that id — which keeps a card pointing at its own item for as long as the
 * content keeps its order. Reorder the file once and every later index means a
 * different phrase, while the cards, which carry their own copy of the text,
 * go on reading correctly. Attaching audio on the strength of a stale index is
 * worse than attaching a picture: the card would *say* a sentence that is not
 * the one written on it. So the item's `text` is compared to the card's
 * `front`, and a card that disagrees has any pack reading taken away rather
 * than replaced.
 *
 * **It never touches a reading made for the card itself.** `voices.ts`
 * synthesises on demand when somebody asks a card to be read aloud, and stores
 * it under `echo/tts/<lang>/<voice>/<hash>.m4a` — keyed by the text, made for
 * that member, and charged to their quota. A pack's own reading lives under
 * `echo/packs/<pack>/<index>-<voice>.m4a`. Only the second is ours to write:
 * the first is already a correct reading of the card's text, and replacing it
 * would spend somebody's quota to change nothing.
 *
 * Three cases are written, then: a card with no readings at all, a card whose
 * pack readings are no longer the URLs the item names, and — as a removal —
 * a card whose index has drifted. The second is what makes a re-seed safe to
 * deploy; without it a reading that moved leaves every existing card pointing
 * at an object that is no longer there.
 *
 * Usage:
 *   pnpm exec tsx --env-file=<env> scripts/backfill-echo-readings.ts
 *   pnpm exec tsx --env-file=<env> scripts/backfill-echo-readings.ts --apply
 */
import type { EchoVoice } from '@langx/shared'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import type { EchoCardDoc } from '../src/modules/echo/documents'
import type { EchoPackItemDoc } from '../src/modules/echo/packs'

/**
 * Whether these readings came from a pack rather than from the read-aloud
 * service. By the key the two are written under, which is the only thing that
 * tells them apart once they are a URL on a card — see the header.
 */
function fromPack(voices: readonly EchoVoice[] | undefined): boolean {
  return Boolean(voices?.length) && voices!.every((take) => take.url.includes('/echo/packs/'))
}

/** Same readings, same order. The order is the language's register order. */
function same(a: readonly EchoVoice[] | undefined, b: readonly EchoVoice[]): boolean {
  return (
    a?.length === b.length &&
    a.every((take, at) => take.url === b[at]?.url && take.voice === b[at]?.voice)
  )
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const env = loadEnv(process.env)
  const handle = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

  try {
    const items = handle.db.collection<EchoPackItemDoc>(COLLECTIONS.echoPackItems)
    const cards = handle.db.collection<EchoCardDoc>(COLLECTIONS.echoCards)

    /*
     * The whole item table in memory, which is fine at this size — eighteen
     * packs of under three hundred — and is what lets the card pass below be
     * one cursor rather than a lookup per card.
     */
    const readingOf = new Map<string, { voices: EchoVoice[]; text: string }>()
    for await (const item of items.find({ voices: { $exists: true, $ne: [] } })) {
      if (item.voices?.length) readingOf.set(item._id, { voices: item.voices, text: item.text })
    }
    console.log(`${readingOf.size} pack item(s) carry readings.`)
    if (readingOf.size === 0) {
      console.log('Nothing to copy. Seed the packs first.')
      return
    }

    let silent = 0
    let stale = 0
    let missing = 0
    let ownReading = 0
    const writes: { id: EchoCardDoc['_id']; voices: EchoVoice[] | null }[] = []
    const drifted: string[] = []
    for await (const card of cards.find({ sourceKey: /^pack:/ })) {
      const reading = readingOf.get(card.sourceKey.slice('pack:'.length))
      if (!reading) {
        // A card from an item the content has since dropped, or one whose item
        // has no readings. Left as it is: the card belongs to whoever made it.
        missing += 1
        continue
      }
      if (reading.text !== card.front) {
        // The index no longer names this phrase — see the header. Take the
        // readings away if they came from the wrong item, and never add.
        drifted.push(`"${card.front}" → ${card.sourceKey}, now "${reading.text}"`)
        if (fromPack(card.voices)) writes.push({ id: card._id, voices: null })
        continue
      }
      if (card.voices?.length && !fromPack(card.voices)) {
        // Made for this card by the read-aloud service. Not ours to replace.
        ownReading += 1
        continue
      }
      if (same(card.voices, reading.voices)) continue
      if (card.voices?.length) stale += 1
      else silent += 1
      writes.push({ id: card._id, voices: reading.voices })
    }

    const removals = writes.filter((write) => write.voices === null).length
    console.log(
      `${writes.length} card(s) to write: ${silent} silent, ${stale} stale, ${removals} wrong.`,
    )
    if (ownReading > 0) console.log(`  ${ownReading} carry a reading of their own, left alone.`)
    if (missing > 0) console.log(`  ${missing} point at an item with no readings to give.`)
    if (drifted.length > 0) {
      console.log(`  ${drifted.length} card(s) point at an index that has since moved:`)
      for (const line of drifted.slice(0, 5)) console.log(`    ${line}`)
    }
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
          updateOne: {
            filter: { _id: write.id },
            update: write.voices
              ? { $set: { voices: write.voices } }
              : { $unset: { voices: '' as const } },
          },
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
