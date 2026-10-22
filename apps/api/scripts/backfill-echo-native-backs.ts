/**
 * Fills the empty backs of cards kept from a sentence in the reader's own
 * language, the way a capture fills them now.
 *
 * A Turkish reader keeping a Turkish sentence used to get the sentence back
 * as its "translation". #1925 stopped storing that, and
 * `backfill-echo-same-backs.ts` emptied the cards already stored that way, so
 * those cards say "No meaning on this card yet". A capture now translates such
 * a sentence into the language the reader is learning instead (`backFor` in
 * `src/modules/echo/cards.ts`), and this runs the same rule — `backForReader`
 * — over every card a message or a post left with an empty back. A card whose
 * back was empty for another reason (the provider was down, no key was
 * configured) gets what a tap would give it today, which is its meaning.
 *
 * Only cards kept from a message or a post, as in the earlier script: a
 * hand-written card's back is its author's and a pack's is curated. The
 * partner is the chat's other participant, read now; a post has none. A post
 * card is translated from the post's body, as at capture, while the post is
 * still there, and from its front once it is not.
 *
 * **The dry run asks the provider too** — that is how it can show what would
 * be written. What it is told goes into the shared translation cache, exactly
 * as a tap's would; no card is touched without `--apply`. Each write names the
 * empty back it read, so a card somebody filled in the meantime keeps theirs.
 *
 * Usage (from apps/api):
 *   pnpm exec tsx --env-file=<env> scripts/backfill-echo-native-backs.ts
 *   pnpm exec tsx --env-file=<env> scripts/backfill-echo-native-backs.ts --apply
 */
import { ObjectId } from 'mongodb'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import { backFields, backForReader, type CardBack } from '../src/modules/echo/cards'
import type { EchoCardDoc } from '../src/modules/echo/documents'
import type { Post } from '../src/modules/feed/documents'
import type { Profile } from '../src/modules/profiles/profiles'
import { createTranslationProvider } from '../src/translation/createTranslationProvider'

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const env = loadEnv(process.env)
  const handle = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)
  const deps = { translation: createTranslationProvider(env) }

  try {
    const db = handle.db
    const cards = db.collection<EchoCardDoc>(COLLECTIONS.echoCards)
    const profiles = db.collection<Profile>(COLLECTIONS.profiles)
    const empty = await cards
      .find({ sourceKey: /^(msg|post):/, back: '' })
      .project<Pick<EchoCardDoc, '_id' | 'userId' | 'front' | 'lang' | 'source' | 'sourceKey'>>({
        userId: 1,
        front: 1,
        lang: 1,
        source: 1,
        sourceKey: 1,
      })
      .toArray()

    const found: { card: (typeof empty)[number]; meaning: CardBack }[] = []
    let unfilled = 0
    for (const card of empty) {
      const me = await profiles.findOne({ _id: card.userId })
      if (!me) {
        unfilled++
        continue
      }
      let partnerNative: Profile['nativeLanguages'] | undefined
      let text = card.front
      if (card.source.kind === 'chat') {
        const partner = await profiles.findOne(
          { _id: card.source.partnerId },
          { projection: { nativeLanguages: 1 } },
        )
        partnerNative = partner?.nativeLanguages
      } else if (card.source.kind === 'post' && ObjectId.isValid(card.source.postId)) {
        const post = await db
          .collection<Post>(COLLECTIONS.posts)
          .findOne({ _id: new ObjectId(card.source.postId) }, { projection: { body: 1 } })
        if (post?.body.trim()) text = post.body.trim()
      }

      const meaning = await backForReader(db, deps, me, partnerNative, text)
      if (meaning.back === '') unfilled++
      else found.push({ card, meaning })
    }

    const toLearning = found.filter((row) => row.meaning.backLang).length
    console.log(`${empty.length} card(s) from a message or a post with an empty back.`)
    console.log(`  ${toLearning} get the sentence in a language being learned.`)
    console.log(`  ${found.length - toLearning} get a meaning in the reader's own language.`)
    console.log(`  ${unfilled} stay empty (nothing to learn into, or nothing translated).`)
    for (const { card, meaning } of found.slice(0, 10)) {
      const languages = meaning.backLang
        ? `${meaning.lang ?? card.lang} -> ${meaning.backLang}`
        : card.lang
      console.log(`  ${card.sourceKey} [${languages}]: "${card.front}" / "${meaning.back}"`)
    }
    if (!apply) {
      console.log('Dry run. Pass --apply to write.')
      return
    }

    let written = 0
    for (const { card, meaning } of found) {
      const result = await cards.updateOne(
        { _id: card._id, userId: card.userId, back: '' },
        { $set: backFields(meaning) },
      )
      written += result.modifiedCount
    }
    console.log(`Filled ${written} back(s).`)
  } finally {
    await handle.close()
  }
}

await main()
