import { z } from 'zod'

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
 * What a card can be about. Achievements only — a streak, a badge, a rank are
 * things the owner did, so a card of one is somebody sharing their own
 * progress. A post or a message is somebody else's sentence.
 */
export const CARD_KINDS = ['streak', 'badge', 'rank'] as const
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
