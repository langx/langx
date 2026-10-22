/**
 * Turns round the cards left with an empty back because their sentence was
 * already in the reader's own language.
 *
 * A Turkish reader keeping a Turkish sentence used to get the sentence back
 * as its "translation". #1925 stopped storing that, and
 * `backfill-echo-same-backs.ts` emptied the cards already stored that way, so
 * those cards say "No meaning on this card yet". A capture now translates such
 * a sentence into the language the reader is learning instead (`backFor` in
 * `src/modules/echo/cards.ts`). This runs the same rule — `backForReader` —
 * over every card a message or a post left with an empty back, and writes
 * **only the turned-round ones**: a card whose back would be a meaning in the
 * reader's own language was empty for some other reason (the provider was
 * down, or its owner cleared it in Edit), and is not this script's to fill.
 * It is counted and left alone.
 *
 * Only cards kept from a message or a post, as in the earlier script: a
 * hand-written card's back is its author's and a pack's is curated. Skipped:
 * cards of an account in its deletion grace, and of a post since hidden by
 * moderation. The partner is the chat's other participant, read now; a post
 * has none. A post card is translated from the post's body, as at capture.
 *
 * **A card kept from a correction never reaches the provider** — it may have
 * been kept automatically, and automatic capture must not send text nobody
 * asked to translate (see `correctionCapture.ts`). Such a card turns round
 * only from the shared cache.
 *
 * **The dry run asks the provider too** — that is how it can show what would
 * be written. What it is told goes into the shared translation cache, exactly
 * as a tap's would; no card is touched without `--apply`. Each write names the
 * empty back and the language it read (`fillBackWrite`), so a card somebody
 * changed in the meantime keeps what they did.
 *
 * Usage (from apps/api):
 *   pnpm exec tsx --env-file=<env> scripts/backfill-echo-native-backs.ts
 *   pnpm exec tsx --env-file=<env> scripts/backfill-echo-native-backs.ts --apply
 */
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import type { Message } from '../src/modules/chat/conversations'
import {
  backForReader,
  fillBackWrite,
  type CaptureDeps,
  type CardBack,
} from '../src/modules/echo/cards'
import type { EchoCardDoc } from '../src/modules/echo/documents'
import { notHidden, type Post } from '../src/modules/feed/documents'
import type { Profile } from '../src/modules/profiles/profiles'
import { createTranslationProvider } from '../src/translation/createTranslationProvider'

const CACHE_ONLY: CaptureDeps = {
  translation: {
    translate: () => Promise.reject(new Error('A correction card turns round from the cache only')),
  },
}

type Row = Pick<
  EchoCardDoc,
  '_id' | 'userId' | 'front' | 'lang' | 'voices' | 'reading' | 'source' | 'sourceKey'
>

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const env = loadEnv(process.env)
  const handle = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)
  const provider: CaptureDeps = { translation: createTranslationProvider(env) }

  try {
    const db = handle.db
    const cards = db.collection<EchoCardDoc>(COLLECTIONS.echoCards)
    const profiles = db.collection<Profile>(COLLECTIONS.profiles)
    const empty = await cards
      .find({ sourceKey: /^(msg|post):/, back: '' })
      .project<Row>({
        userId: 1,
        front: 1,
        lang: 1,
        voices: 1,
        reading: 1,
        source: 1,
        sourceKey: 1,
      })
      .toArray()

    const turned: { card: Row; meaning: CardBack }[] = []
    let ownLanguage = 0
    let unfilled = 0
    let skipped = 0
    for (const card of empty) {
      const me = await profiles.findOne({ _id: card.userId })
      if (!me || me.deletedAt) {
        skipped++
        continue
      }

      let partnerNative: Profile['nativeLanguages'] | undefined
      let text = card.front
      let deps = provider
      if (card.source.kind === 'chat') {
        const [partner, message] = await Promise.all([
          profiles.findOne({ _id: card.source.partnerId }, { projection: { nativeLanguages: 1 } }),
          ObjectId.isValid(card.source.messageId)
            ? db
                .collection<Message>(COLLECTIONS.messages)
                .findOne({ _id: new ObjectId(card.source.messageId) }, { projection: { type: 1 } })
            : null,
        ])
        partnerNative = partner?.nativeLanguages
        // A message since deleted is treated as a correction: nothing says it was not.
        if (!message || message.type === 'correction') deps = CACHE_ONLY
      } else if (card.source.kind === 'post') {
        const post = ObjectId.isValid(card.source.postId)
          ? await db
              .collection<Post>(COLLECTIONS.posts)
              .findOne(
                { _id: new ObjectId(card.source.postId), ...notHidden() },
                { projection: { body: 1 } },
              )
          : null
        if (!post) {
          skipped++
          continue
        }
        if (post.body.trim()) text = post.body.trim()
      }

      const meaning = await backForReader(db, deps, me, partnerNative, text)
      if (meaning.backLang) turned.push({ card, meaning })
      else if (meaning.back !== '') ownLanguage++
      else unfilled++
    }

    console.log(`${empty.length} card(s) from a message or a post with an empty back.`)
    console.log(`  ${turned.length} turn round: the sentence in a language being learned.`)
    console.log(`  ${ownLanguage} would get a meaning in the reader's own language; left alone.`)
    console.log(`  ${unfilled} stay empty (nothing to learn into, or nothing translated).`)
    console.log(`  ${skipped} skipped (account being deleted, or post gone or hidden).`)
    for (const { card, meaning } of turned.slice(0, 10)) {
      console.log(
        `  ${card.sourceKey} [${meaning.lang ?? card.lang} -> ${meaning.backLang}]: "${card.front}" / "${meaning.back}"`,
      )
    }
    if (!apply) {
      console.log('Dry run. Pass --apply to write.')
      return
    }

    let written = 0
    for (const { card, meaning } of turned) {
      const write = fillBackWrite(card, meaning)
      const result = await cards.updateOne(write.filter, write.update)
      written += result.modifiedCount
    }
    console.log(`Turned round ${written} card(s).`)
  } finally {
    await handle.close()
  }
}

await main()
