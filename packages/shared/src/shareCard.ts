import { z } from 'zod'
import { localeSchema } from './locales'

/**
 * The shapes a share card is drawn in.
 *
 * A card for a story is a tall 9:16 and a card for a timeline is a wide 16:9;
 * posting either in the other place gets it cropped through the middle or
 * shrunk into a stamp. So the target is chosen before the picture is drawn.
 */
export const CARD_SHAPES = ['story', 'square', 'wide'] as const
export type CardShape = (typeof CARD_SHAPES)[number]

/**
 * What a card can be about. Achievements only — a streak, a badge, a rank, a
 * month's recap are things the owner did, so a card of one is somebody sharing
 * their own progress. A post or a message is somebody else's sentence.
 *
 * `publicShareCardSchema` validates the stored kind on the way out, so a kind
 * has to be listed here before any card of it is written.
 */
export const CARD_KINDS = ['streak', 'badge', 'rank', 'recap'] as const
export type CardKind = (typeof CARD_KINDS)[number]

/**
 * The wording is sent by the client, not built on the server, because it is
 * the *reader's* language and the eight catalogues live in the app. The server
 * still bounds it: these lengths are what the layout can draw without the type
 * shrinking to nothing.
 */
export const createShareCardSchema = z.object({
  kind: z.enum(CARD_KINDS),
  shape: z.enum(CARD_SHAPES),
  headline: z.string().trim().min(1).max(40),
  caption: z.string().trim().min(1).max(80),
  /**
   * What turns a recap card from a month's name into the month itself. Only
   * read when `kind` is `recap`, and optional so a build from before it still
   * gets the plain card rather than a 400.
   */
  recap: z.lazy(() => recapCardInputSchema).optional(),
})
export type CreateShareCardInput = z.infer<typeof createShareCardSchema>

export const shareCardResultSchema = z.object({
  id: z.string(),
  imageUrl: z.string(),
  /** The page, never the bucket: `app.langx.io/s/<id>`. */
  shareUrl: z.string(),
})
export type ShareCardResult = z.infer<typeof shareCardResultSchema>

/** What the public share page reads. No identifiers beyond the handle. */
export const publicShareCardSchema = z.object({
  id: z.string(),
  kind: z.enum(CARD_KINDS),
  shape: z.enum(CARD_SHAPES),
  imageUrl: z.string(),
  headline: z.string(),
  caption: z.string(),
  handle: z.string(),
})
export type PublicShareCard = z.infer<typeof publicShareCardSchema>

/** `?month=YYYY-MM`; omitted means the month before the current UTC one. */
export const monthlyRecapQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
})

/**
 * One person's month, computed on the server from the same rows the monthly
 * email reads.
 *
 * `currentStreak` is today's streak, not the month's: nothing stores a streak
 * per month, so the screen labels it as the current one rather than implying
 * a history it does not have.
 */
export const monthlyRecapSchema = z.object({
  month: z.string(),
  messages: z.number().int().nonnegative(),
  corrections: z.number().int().nonnegative(),
  tokens: z.number().int(),
  echoReviews: z.number().int().nonnegative(),
  currentStreak: z.number().int().nonnegative(),
  /**
   * Different people messaged, from the partner list `dailyActivity` already
   * keeps per day for the per-partner cap — a union of thirty short arrays.
   */
  partners: z.number().int().nonnegative(),
  /** Days with at least one message or correction sent. */
  activeDays: z.number().int().nonnegative(),
  /**
   * Which days those were, as days of the month (1–31, UTC), for the story's
   * calendar. Read from the same rows as `activeDays`, so it costs nothing.
   */
  activeDates: z.array(z.number().int().min(1).max(31)),
})
export type MonthlyRecapDto = z.infer<typeof monthlyRecapSchema>

/**
 * The recap's numbers that can lead a tile, in the order they lead.
 *
 * `partners` is not one of them: the poster says it in a sentence under the
 * month ("with 12 people") rather than as a fifth number.
 */
export const RECAP_STATS = [
  'messages',
  'corrections',
  'echoReviews',
  'currentStreak',
  'activeDays',
  'tokens',
] as const satisfies readonly (keyof MonthlyRecapDto)[]
export type RecapStat = (typeof RECAP_STATS)[number]

/**
 * The (at most) four numbers a recap leads with: the first ones in
 * `RECAP_STATS` that are not zero.
 *
 * A fixed order rather than "the biggest four", because the numbers are not
 * in one unit — 212 tokens is not a bigger month than 40 messages — and the
 * order is the product's own priority: talking first, then teaching, then
 * practising alone, then showing up. Active days and tokens only surface when
 * the month had little else, which is also when they are the good news.
 *
 * Shared because the story's last slide and the card drawn from it have to
 * show the same four, and the server is the one that draws the card.
 */
export function recapHighlights(recap: MonthlyRecapDto, max = 4): RecapStat[] {
  return RECAP_STATS.filter((stat) => recap[stat] > 0).slice(0, max)
}

/** One label per number, each already in the plural form for its count. */
const recapLabel = z.string().trim().min(1).max(40)

/**
 * The wording for a recap card. The numbers are not in it: the server reads
 * them from the ledger for `month` itself, so the picture cannot say more than
 * the account did. What the client supplies is only what it alone has — the
 * reader's language — which is the same split every other card makes.
 *
 * `locale` is for the numerals and the direction the card is laid out in; the
 * labels are already in it.
 */
export const recapCardInputSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  locale: localeSchema,
  /** The line above the month: "My month on LangX". */
  kicker: z.string().trim().min(1).max(40),
  labels: z.object({
    messages: recapLabel,
    corrections: recapLabel,
    echoReviews: recapLabel,
    activeDays: recapLabel,
    currentStreak: recapLabel,
    tokens: recapLabel,
  }),
  /**
   * "in two languages, with 12 people", already in the plural form for the
   * count `GET /me/recap` gave the app. The one number that arrives as words:
   * a count spelled into a sentence has to be chosen with its grammar, and the
   * catalogues are on the device. The server still drops the line when its
   * own count for the month is zero.
   */
  people: z.string().trim().min(1).max(60).optional(),
  /** "Spanish → learning Turkish", under the handle. */
  languages: z.string().trim().min(1).max(60).optional(),
})
export type RecapCardInput = z.infer<typeof recapCardInputSchema>
