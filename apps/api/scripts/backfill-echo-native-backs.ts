/**
 * Fills the cards a message or a post left with an empty back, by the rule a
 * capture uses today: `backForReader` in `src/modules/echo/cards.ts`, whose
 * "own language" is the reader's native one from their profile.
 *
 * Two kinds of fill, both written:
 *
 * - **A meaning in the reader's native language** — the common case: a
 *   sentence in a language they learn. Such a card is empty because nothing
 *   translated it at the time (the provider failed, or was not set up yet).
 * - **Turned round** — a sentence already in the reader's native language,
 *   which #1925 stopped storing as its own back and
 *   `backfill-echo-same-backs.ts` emptied. It gets the sentence in a language
 *   they learn, `backLang` saying which (#1941).
 *
 * The first version wrote only the second kind and counted the first as not
 * its to fill, which is why its production run found six empty cards with
 * fronts in a learning language and filled none of them. A back its owner
 * emptied in Edit cannot be told apart from one nothing translated, because
 * nothing on the card records the edit. So the dry run lists every card it
 * would fill: read the list before `--apply`.
 *
 * Only cards kept from a message or a post, as in the earlier script: a
 * hand-written card's back is its author's and a pack's is curated. Skipped:
 * cards of an account in its deletion grace, and of a post since hidden by
 * moderation. The partner is the chat's other participant, read now; a post
 * has none. A post card is translated from the post's body, as at capture.
 *
 * **A card kept from a correction never reaches the provider** — it may have
 * been kept automatically, and automatic capture must not send text nobody
 * asked to translate (see `correctionCapture.ts`). Such a card is filled only
 * from the shared cache, and so is one whose message has since been deleted.
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
    translate: () => Promise.reject(new Error('A correction card is filled from the cache only')),
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

    const filled: { card: Row; meaning: CardBack }[] = []
    const unfilled: Row[] = []
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
      if (meaning.back !== '') filled.push({ card, meaning })
      else unfilled.push(card)
    }

    const turned = filled.filter(({ meaning }) => meaning.backLang).length
    console.log(`${empty.length} card(s) from a message or a post with an empty back.`)
    console.log(`  ${filled.length - turned} get a meaning in the reader's native language.`)
    console.log(`  ${turned} turn round: the sentence in a language being learned.`)
    console.log(`  ${unfilled.length} stay empty (nothing translated it, or only into itself).`)
    console.log(`  ${skipped} skipped (account being deleted, or post gone or hidden).`)
    for (const { card, meaning } of filled.slice(0, 50)) {
      const into = meaning.backLang ?? 'native'
      console.log(
        `  fill ${card.sourceKey} [${meaning.lang ?? card.lang} -> ${into}]: "${card.front}" / "${meaning.back}"`,
      )
    }
    for (const card of unfilled.slice(0, 50)) {
      console.log(`  empty ${card.sourceKey} [${card.lang}]: "${card.front}"`)
    }
    if (!apply) {
      console.log('Dry run. Pass --apply to write.')
      return
    }

    let written = 0
    for (const { card, meaning } of filled) {
      const write = fillBackWrite(card, meaning)
      const result = await cards.updateOne(write.filter, write.update)
      written += result.modifiedCount
    }
    console.log(`Filled ${written} card(s).`)
  } finally {
    await handle.close()
  }
}

await main()
