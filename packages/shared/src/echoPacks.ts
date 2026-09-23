import { z } from 'zod'
import { speechVoicesFor } from './speech'
import { CEFR_TO_LANGUAGE_LEVEL, languageLevelSchema, type LanguageLevel } from './level'
import { localeSchema } from './locales'
import { SRS_RULES } from './srs'

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
 * Which Kokoro voices read a card in each language, and so which languages a
 * member's own card can be read in at all.
 *
 * Two per language where the model has both registers, for the reason the
 * schema above is a list: one synthetic reading reads as *the* pronunciation.
 * French has one voice in the model, so French gets one. Japanese is absent on
 * purpose — the model has voices for it, but the service phonemises through
 * espeak-ng, which is not what those voices were trained on, and a reading a
 * native speaker would wince at is worse than none. Chinese was absent for the
 * same reason until it was given its own phonemiser; see `zh_phonemes` in
 * `apps/tts/server.py`, and the measurement there.
 *
 * Shared rather than API-only because the app reads it too: the card screen
 * offers "Read it aloud" only for a language that has an entry here, so a
 * refusal is never the first the person hears of it.
 */
export const ECHO_SYNTH_VOICES: Readonly<Record<string, readonly string[]>> = {
  en: ['af_heart', 'am_michael'],
  es: ['ef_dora', 'em_alex'],
  fr: ['ff_siwis'],
  it: ['if_sara', 'im_nicola'],
  pt: ['pf_dora', 'pm_alex'],
  hi: ['hf_alpha', 'hm_omega'],
  // The best two of Kokoro's eight Chinese voices, measured: a speech
  // recogniser read back 97% of the characters from each, and 76% from
  // `zf_xiaoni`, the worst.
  zh: ['zf_xiaoyi', 'zm_yunxi'],
}

/**
 * The voices that can read `lang`; empty for a language nothing here speaks.
 *
 * Delegates to `SPEECH_VOICES`, which is the wider table — so a card in one of
 * the thirty-one languages Piper reads can be read aloud too, and the button on
 * the card screen appears wherever chat's does. `ECHO_SYNTH_VOICES` above stays
 * as it is: it is what `apps/tts/server.py` mirrors for Kokoro, and the six it
 * names are still the six that lead with two registers.
 */
export function echoSynthVoicesFor(lang: string): readonly string[] {
  return speechVoicesFor(lang).map((voice) => voice.id)
}

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
  /**
   * `echo/packs/<packId with : as _>/<index>-<voice>.m4a`, and derivable.
   *
   * The voice may carry hyphens: Kokoro names a voice `af_heart`, Piper names
   * one `de_DE-thorsten-medium`, and the languages Piper answers for are the
   * ones a pack outside Kokoro's six has to be read by.
   */
  key: z
    .string()
    .trim()
    .regex(/^echo\/packs\/[A-Za-z0-9_-]+\/\d+-[A-Za-z0-9_-]+\.m4a$/),
  voice: z.string().trim().min(1),
})
export type EchoPackVoice = z.infer<typeof echoPackVoiceSchema>

/** Where a pack's reading of an item lives, given an environment's base URL. */
export function packVoiceKey(packId: string, index: number, voice: string): string {
  return `echo/packs/${packId.replace(':', '_')}/${index}-${voice}.m4a`
}

/**
 * Where a cue's picture lives, given an environment's base URL.
 *
 * Keyed by the slug and by nothing else — not the pack, not the index — which
 * is the whole reason a cue is shared: one upload serves every card that
 * points at it, in every pack and every language. `packVoiceKey` cannot work
 * that way because a reading *is* per item.
 *
 * PNG rather than the vector it is drawn as, because expo-image hands an SVG
 * to each platform's own decoder and iOS's mishandles the arc syntax most of
 * OpenMoji is minified into. A flat raster has nothing to disagree about.
 */
export function packImageKey(slug: string): string {
  return `echo/packs/images/${slug}.png`
}

export const echoPackItemSchema = z.object({
  /** Position in the pack, and the second half of `pack_index_unique`. */
  index: z.number().int().nonnegative(),
  kind: z.enum(ECHO_PACK_ITEM_KINDS),
  /** The word itself, in the language being learned. Never translated copy. */
  text: z.string().trim().min(1),
  /**
   * How `text` is read, where its script does not say: pinyin, for Chinese.
   *
   * On the item rather than derived in the app, because deriving it is the
   * hard part — 觉 is *jué* in 觉得 and *jiào* in 睡觉, and a table of
   * characters gets that wrong — so it is decided once, by the pipeline, and
   * read by a person before it ships. Absent for every alphabetic pack.
   */
  reading: z.string().trim().min(1).optional(),
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
   * `cue:<slug>` — the picture above the sentence, named by what it shows
   * rather than by which pack it belongs to.
   *
   * A slug rather than a file, because the cue is shared: "🤝" is the picture
   * for sixteen different phrases, and sixteen copies of one drawing is
   * sixteen chances for fifteen of them to go stale. `content/echo/images/`
   * holds one file per slug and `tools/echo-content/images/cues.<lang>.json`
   * says which phrase points at which — see that file's header for why the cue is
   * written there as an emoji and never shipped as one.
   *
   * This used to read `openmoji:<hex>` and to be documented as "for a noun you
   * can point at, and absent for everything else". Nothing ever carried it:
   * these packs are phrases end to end, so the rule as written could not fire
   * once in eight hundred items. What replaced it is a cue for the *meaning*,
   * which is a thing a phrase does have.
   */
  image: z
    .string()
    .trim()
    .regex(/^cue:[a-z0-9-]+$/)
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
 * The HSK 2.0 levels, and where each sits on our scale.
 *
 * Chinese is the one pack language with a published syllabus a learner already
 * measures themselves by, so its packs are named by it — "HSK 3", not
 * "Intermediate" — and there are six of them where every other language has
 * three. The scale underneath does not change: `level` stays one of our four,
 * so the list sorts and filters exactly as it does for French, and the HSK
 * number is the label and the tiebreak inside a level.
 *
 * The mapping is Hanban's own: HSK 2.0 was published against CEFR A1–C2, one
 * band per level, and CEFR already has a table onto our four. Going through it
 * rather than writing six lines by hand is what keeps the two from disagreeing.
 */
export const HSK_LEVELS = [1, 2, 3, 4, 5, 6] as const
export type HskLevel = (typeof HSK_LEVELS)[number]

const HSK_CEFR: Record<HskLevel, string> = { 1: 'A1', 2: 'A2', 3: 'B1', 4: 'B2', 5: 'C1', 6: 'C2' }

export function hskLanguageLevel(hsk: HskLevel): LanguageLevel {
  return CEFR_TO_LANGUAGE_LEVEL[HSK_CEFR[hsk]]!
}

const hskLevelSchema = z.literal(HSK_LEVELS)

/**
 * The file on disk, and what the seed script reads.
 *
 * `contentVersion` is what makes a re-seed safe to reason about: the seed is
 * idempotent by `{ packId, index }` whatever happens, and this says which
 * draft of the content those rows came from.
 */
export const echoPackFileSchema = z
  .object({
    /**
     * `<lang>:<level>`, e.g. `fr:absoluteBeginner`, or `zh:hsk<n>` for a pack
     * named by its HSK level. The pack's `_id`.
     */
    id: z
      .string()
      .trim()
      .regex(/^[a-z-]+:[a-zA-Z0-9]+$/),
    lang: z.string().trim().min(2),
    level: languageLevelSchema,
    /** The HSK 2.0 level this pack is, for a Chinese pack. See `HSK_LEVELS`. */
    hsk: hskLevelSchema.optional(),
    contentVersion: z.number().int().positive(),
    /** Every source this pack draws on, with its licence. See ATTRIBUTION.md. */
    sources: z.array(z.object({ name: z.string(), licence: z.string(), url: z.url() })).min(1),
    items: z.array(echoPackItemSchema).min(1),
  })
  /*
   * The id is written by hand and becomes every card's `sourceKey`, so it is
   * checked against the fields it summarises: two HSK packs that both called
   * themselves `zh:intermediate` would overwrite each other at the next seed.
   */
  .refine(
    (file) =>
      file.hsk === undefined
        ? file.id === `${file.lang}:${file.level}`
        : file.id === `${file.lang}:hsk${file.hsk}` && file.level === hskLanguageLevel(file.hsk),
    { message: 'id must be <lang>:<level>, or <lang>:hsk<n> at the level HSK n maps to' },
  )
export type EchoPackFile = z.infer<typeof echoPackFileSchema>

/** A pack as the tab lists it. */
export const echoPackSchema = z.object({
  _id: z.string(),
  lang: z.string(),
  level: languageLevelSchema,
  /** Set on a Chinese pack, and then it is the pack's name. See `HSK_LEVELS`. */
  hsk: hskLevelSchema.optional(),
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

/**
 * What a pack would give you next, for looking before pressing Start.
 *
 * Not a page of the pack. It was — offset paging over all three hundred rows,
 * with a "21–40 of 271" and a way back — and nobody read it that way: the
 * question at that screen is "what will I get if I press this", which is the
 * next `limit` items this reader holds no card for, in index order. Exactly
 * the rows `startPack` would write, resolved the same way. The default is a
 * session's worth, because that is what the button takes.
 */
export const echoPackPreviewQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(SRS_RULES.sessionSize),
})
export type EchoPackPreviewQuery = z.infer<typeof echoPackPreviewQuerySchema>

export const echoPackPreviewItemSchema = z.object({
  index: z.number().int().nonnegative(),
  text: z.string(),
  /** Pinyin, on a Chinese pack. See `echoPackItemSchema.reading`. */
  reading: z.string().optional(),
  /** Resolved for this reader, by the same chain a started card would use. */
  back: z.string(),
})
export type EchoPackPreviewItem = z.infer<typeof echoPackPreviewItemSchema>

export const echoPackPreviewSchema = z.object({
  items: z.array(echoPackPreviewItemSchema),
  /** The pack's whole length, which the preview is the next slice of. */
  total: z.number().int().nonnegative(),
})
export type EchoPackPreview = z.infer<typeof echoPackPreviewSchema>
