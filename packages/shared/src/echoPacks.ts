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

/**
 * A synthesised reading of the item, one entry per voice.
 *
 * Kept apart from `audio` because the two are not the same kind of thing.
 * `audio` is a person: it carries a name because the licence asks for one, and
 * the session says "Spoken by". This is a machine pronouncing text that was
 * already decided, so it carries no name and must never be labelled as though
 * it were somebody. See `docs/decisions.md` for why synthesis is allowed for a
 * reading and refused for a gloss.
 *
 * A list rather than one field: a single synthetic reading reads as *the*
 * pronunciation, where two in different registers read as what they are.
 */
export const echoVoiceSchema = z.object({
  url: z.url(),
  /** The voice it was read in, e.g. `af_heart`. The app maps it to a label. */
  voice: z.string().trim().min(1),
})
export type EchoVoice = z.infer<typeof echoVoiceSchema>

/**
 * The same reading as it is written down, which is a storage key rather than a
 * URL — the one place in this codebase where media is recorded that way.
 *
 * Everywhere else a URL is right because the object belongs to whoever sent
 * it and there is nothing to recompute. These belong to the pack, they are
 * uploaded once per environment under a key this file decides, and writing the
 * bucket into the content would make `content/echo/` say which deployment it
 * was for. It is the same file in dev and in production; `seed-echo-packs.ts`
 * joins the key to `STORAGE_PUBLIC_BASE_URL` and the card gets a URL like
 * every other piece of media.
 */
export const echoPackVoiceSchema = z.object({
  /** `echo/packs/<packId with : as _>/<index>-<voice>.m4a`, and derivable. */
  key: z
    .string()
    .trim()
    .regex(/^echo\/packs\/[A-Za-z0-9_-]+\/\d+-[A-Za-z0-9_]+\.m4a$/),
  voice: z.string().trim().min(1),
})
export type EchoPackVoice = z.infer<typeof echoPackVoiceSchema>

/** Where a pack's reading of an item lives, given an environment's base URL. */
export function packVoiceKey(packId: string, index: number, voice: string): string {
  return `echo/packs/${packId.replace(':', '_')}/${index}-${voice}.m4a`
}

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
  /**
   * A human saying it: a Wikimedia Commons recording, with the credit its
   * licence requires.
   *
   * One object rather than a bare URL, because a URL on its own cannot be
   * lawfully played. Every licence on the allowlist — CC0 aside — requires
   * naming the author, and `speaker` is how that name reaches
   * `EchoAudio.speakerName`, which the session already draws as
   * "Spoken by {name}".
   *
   * `file` and `licence` are the record of the check rather than anything the
   * app reads: `docs/echo.md` says to verify a source at the version
   * downloaded and write down what was found, and this is that, per file.
   *
   * **The URL points at Commons**, not at our own storage — the decision
   * `build-pack.mjs` said nobody had taken. Its cost is that a file renamed or
   * deleted there silences the card. Acceptable here and nowhere else: a pack
   * is content we can re-seed, where a captured sentence is somebody's own.
   */
  audio: z
    .object({
      url: z.url(),
      /** The Commons `File:` title the licence was checked against. */
      file: z.string().trim().min(1),
      /** Absent only where the licence asks for no attribution. */
      speaker: z.string().trim().min(1).optional(),
      licence: z.string().trim().min(1),
    })
    .optional(),
  /** Synthesised readings. A human recording above is better and comes first. */
  voices: z.array(echoPackVoiceSchema).optional(),
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

/** A page of a pack's contents, for looking before starting. */
export const ECHO_PACK_PREVIEW_PAGE = 20

/**
 * Offset paging rather than a cursor, which everything else here uses.
 *
 * A cursor exists because rows shift under a reader — new cards arrive, old
 * ones move. A pack does not: its items are `0 … itemCount - 1` and stay
 * there, because the seed is idempotent by `{ packId, index }` and a card's
 * `sourceKey` depends on it. So an offset is exact, and it buys the one thing
 * a cursor cannot — "showing 21–40 of 271", and a way back.
 */
export const echoPackPreviewQuerySchema = z.object({
  offset: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().min(1).max(50).default(ECHO_PACK_PREVIEW_PAGE),
})
export type EchoPackPreviewQuery = z.infer<typeof echoPackPreviewQuerySchema>

export const echoPackPreviewItemSchema = z.object({
  index: z.number().int().nonnegative(),
  text: z.string(),
  /** Resolved for this reader, by the same chain a started card would use. */
  back: z.string(),
})
export type EchoPackPreviewItem = z.infer<typeof echoPackPreviewItemSchema>

export const echoPackPreviewSchema = z.object({
  items: z.array(echoPackPreviewItemSchema),
  /** The pack's whole length, so the page can say what it is a slice of. */
  total: z.number().int().nonnegative(),
})
export type EchoPackPreview = z.infer<typeof echoPackPreviewSchema>
