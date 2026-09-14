import type {
  EchoAudio,
  EchoCard,
  EchoGrade,
  EchoImage,
  EchoSource,
  EchoSrs,
  EchoSrsDto,
} from '@langx/shared'
import type { ObjectId } from 'mongodb'

/**
 * A card, as it is stored.
 *
 * `front`, `back` and the media are **copies**, taken at capture. The message
 * they came from can be edited, deleted, or sit in a conversation somebody has
 * left; the account that wrote it can go. A card somebody has reviewed six
 * times is theirs, and none of that may empty it. The deep link back to the
 * thread is the one part allowed to stop resolving.
 *
 * `source` holds its ids as strings rather than `ObjectId`s. Nothing ever
 * queries a card by them — `sourceKey` is what the index uses — so storing the
 * shape the DTO already describes makes the mapper below an identity instead
 * of a conversion that could drift.
 */
export interface EchoCardDoc {
  _id: ObjectId
  userId: string
  lang: string
  front: string
  back: string
  example?: string
  audio?: EchoAudio
  image?: EchoImage
  /**
   * The pronunciation post opened from this card, when its owner asked the
   * feed how the sentence is said. The one field here that is a *link* rather
   * than a copy, and it may stop resolving like `source` does — the post can
   * be deleted, and the button that depends on it simply stops being drawn.
   *
   * A card asked twice keeps only the newer post. The older one loses its
   * button, which is cheaper than a list nobody would read.
   */
  askedPostId?: string
  source: EchoSource
  /** `sourceKeyOf(source)`. The second half of `card_source_unique`. */
  sourceKey: string
  srs: EchoSrs
  createdAt: Date
}

/**
 * One graded card, written before the card is advanced.
 *
 * `reviewId` is the client's, and `user_review_unique` is what makes a
 * retried session incapable of paying twice. `durationMs` is recorded and not
 * yet read by anything — it is the only signal that would say whether a card
 * is too long to be a card, and it cannot be recovered later.
 */
export interface EchoReviewDoc {
  _id: ObjectId
  userId: string
  reviewId: string
  cardId: ObjectId
  grade: EchoGrade
  at: Date
  durationMs: number
}

/** The schedule as it travels: the same numbers, with the dates as strings. */
export function toEchoSrs(srs: EchoSrs): EchoSrsDto {
  return {
    state: srs.state,
    step: srs.step,
    due: srs.due.toISOString(),
    interval: srs.interval,
    ease: srs.ease,
    reps: srs.reps,
    lapses: srs.lapses,
    lastReviewedAt: srs.lastReviewedAt ? srs.lastReviewedAt.toISOString() : null,
  }
}

export function toEchoCard(doc: EchoCardDoc): EchoCard {
  return {
    _id: doc._id.toHexString(),
    front: doc.front,
    back: doc.back,
    ...(doc.example ? { example: doc.example } : {}),
    lang: doc.lang,
    source: doc.source,
    ...(doc.audio ? { audio: doc.audio } : {}),
    ...(doc.image ? { image: doc.image } : {}),
    ...(doc.askedPostId ? { askedPostId: doc.askedPostId } : {}),
    srs: toEchoSrs(doc.srs),
    createdAt: doc.createdAt.toISOString(),
  }
}
