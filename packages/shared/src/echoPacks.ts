import { z } from 'zod'
import { languageLevelSchema } from './level'
import { localeSchema } from './locales'

/**
 * Curated packs: the reason the tab is worth opening before you have made a
 * single card of your own.
 *
 * A pack card and a chat card are the same card in the same queue and differ
 * only in `source`. Nothing about capture knows packs exist, and nothing here
 * knows about conversations.
 *
 * Content lives in `content/echo/<lang>/<level>.json`, not in this package:
 * `packages/shared` is config, and a thousand items would be a data blob every
 * consumer parses at import. What lives here is the shape that file has to
 * have, so the seed script and the app cannot disagree about it.
 */

/**
 * A word or a short phrase.
 *
 * The split matters to the session rather than to the schema: a single word is
 * the case a human recording exists for, and phrases are what carry the
 * grammar. Both are drawn the same way today.
 */
export const ECHO_PACK_ITEM_KINDS = ['word', 'phrase'] as const
export type EchoPackItemKind = (typeof ECHO_PACK_ITEM_KINDS)[number]

/**
 * What the item means, per interface locale.
 *
 * Drawn from the **eight** the app speaks, never from the hundred and eighty
 * it can file a card under: the known side of a card is written in a language
 * we ship copy in, and there is nobody to write the other hundred and seventy
 * two.
 *
 * Partial on purpose. A pack whose Arabic column is not finished is still a
 * usable pack in the seven that are, and `glossFor` falls back rather than
 * showing a blank back.
 */
export const echoGlossSchema = z.partialRecord(localeSchema, z.string().trim().min(1))
export type EchoGloss = z.infer<typeof echoGlossSchema>

export const echoPackItemSchema = z.object({
  /** Position in the pack, and the second half of `pack_index_unique`. */
  index: z.number().int().nonnegative(),
  kind: z.enum(ECHO_PACK_ITEM_KINDS),
  /** The word itself, in the language being learned. Never translated copy. */
  text: z.string().trim().min(1),
  gloss: echoGlossSchema,
  /** One sentence using it. Written by us where we can; see the licence file. */
  example: z.string().trim().min(1).optional(),
  /**
   * Where the word sits in a frequency list. Kept because it is the only
   * evidence the ordering is not somebody's taste, and because a later pack
   * has to be able to say "everything between 300 and 1000".
   */
  freqRank: z.number().int().positive().optional(),
  /**
   * `openmoji:<hex>` for a noun you can point at, and absent for everything
   * else. A forced picture for "maybe" teaches nothing.
   */
  image: z
    .string()
    .trim()
    .regex(/^openmoji:[0-9A-F-]+$/)
    .optional(),
  /** A human saying it. A storage URL, on the same rule a card's audio follows. */
  audioUrl: z.url().optional(),
})
export type EchoPackItem = z.infer<typeof echoPackItemSchema>

/**
 * The file on disk, and what the seed script reads.
 *
 * `contentVersion` is what makes a re-seed safe to reason about: the seed is
 * idempotent by `{ packId, index }` whatever happens, and this says which
 * draft of the content those rows came from.
 */
export const echoPackFileSchema = z.object({
  /** `<lang>:<level>`, e.g. `fr:absoluteBeginner`. The pack's `_id`. */
  id: z
    .string()
    .trim()
    .regex(/^[a-z-]+:[a-zA-Z]+$/),
  lang: z.string().trim().min(2),
  level: languageLevelSchema,
  contentVersion: z.number().int().positive(),
  /** Every source this pack draws on, with its licence. See ATTRIBUTION.md. */
  sources: z.array(z.object({ name: z.string(), licence: z.string(), url: z.url() })).min(1),
  items: z.array(echoPackItemSchema).min(1),
})
export type EchoPackFile = z.infer<typeof echoPackFileSchema>

/** A pack as the tab lists it. */
export const echoPackSchema = z.object({
  _id: z.string(),
  lang: z.string(),
  level: languageLevelSchema,
  itemCount: z.number().int().nonnegative(),
  /** How many of its items this person already holds a card for. */
  startedCount: z.number().int().nonnegative(),
  /** Which locales the pack can write a back in. Drives nothing; explains a lot. */
  glossLocales: z.array(localeSchema),
  contentVersion: z.number().int().positive(),
})
export type EchoPack = z.infer<typeof echoPackSchema>

export const echoPackListSchema = z.object({ items: z.array(echoPackSchema) })

/**
 * The known side of a pack card, for one reader.
 *
 * Their own language first, then the language the app is drawn in, then
 * English. One function, because a fallback chain written twice is a fallback
 * chain that disagrees with itself — and the back of a card is the half a
 * learner cannot check.
 */
export function glossFor(
  gloss: EchoGloss,
  nativeLocale: string | undefined,
  interfaceLocale: string,
): string {
  const tryOrder = [nativeLocale, interfaceLocale, 'en']
  for (const locale of tryOrder) {
    if (!locale) continue
    const found = gloss[locale as keyof EchoGloss]
    if (found) return found
  }
  // Any locale at all beats an empty back.
  return Object.values(gloss)[0] ?? ''
}

/**
 * How many pack cards a person may start in a day.
 *
 * `null` everywhere today — the row exists so that metering intake later is a
 * config change. Capture is metered separately and always has been; this is
 * about the packs, where a person could otherwise start three hundred cards in
 * one sitting and meet all three hundred again tomorrow.
 */
export const startPackSchema = z.object({
  packId: z.string().trim().min(1),
  /** How many to start now. The screen sends a session's worth. */
  count: z.number().int().min(1).max(100).default(10),
})
export type StartPackInput = z.infer<typeof startPackSchema>

export const startPackResultSchema = z.object({
  /** Cards actually written. Fewer than asked when the pack is finished. */
  started: z.number().int().nonnegative(),
  /** Null when nothing limits intake, which is every tier today. */
  remainingToday: z.number().int().nonnegative().nullable(),
})
export type StartPackResult = z.infer<typeof startPackResultSchema>
