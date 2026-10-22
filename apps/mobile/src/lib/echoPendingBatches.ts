import {
  ECHO_REVIEW_BATCH_MAX,
  submitEchoReviewsSchema,
  type SubmitEchoReviewsInput,
} from '@langx/shared'
import type { PendingReview } from './echoSnapshot'

type ReviewToSend = SubmitEchoReviewsInput['reviews'][number]

const reviewSchema = submitEchoReviewsSchema.shape.reviews.element

/**
 * The grades a device kept, cut into requests the server will take.
 *
 * Two ways a queue used to stick for good, both because the server validates
 * the body as a whole and the tab sent everything waiting as one body:
 *
 * - More than `ECHO_REVIEW_BATCH_MAX` waiting — ten sessions with no network —
 *   and every request was refused, while each session after added more.
 * - One entry the schema can never accept, such as a file from an older build
 *   or a grade name since retired, and every request it rode in was refused
 *   with the good grades beside it.
 *
 * So the queue goes in batches of at most the server's ceiling, and an entry
 * that fails the very schema the server applies comes back as `invalid` for
 * the caller to forget: it cannot be sent as it is, and keeping it would
 * only keep it in the way. A malformed *card id* is not one of these — the
 * server answers that one `missing`, inside an accepted batch.
 */
export function pendingBatches(pending: readonly PendingReview[]): {
  batches: ReviewToSend[][]
  invalid: PendingReview[]
} {
  const valid: ReviewToSend[] = []
  const invalid: PendingReview[] = []
  for (const item of pending) {
    const review = {
      reviewId: item.reviewId,
      cardId: item.cardId,
      grade: item.grade,
      durationMs: item.durationMs,
    }
    if (reviewSchema.safeParse(review).success) valid.push(review)
    else invalid.push(item)
  }
  const batches: ReviewToSend[][] = []
  for (let start = 0; start < valid.length; start += ECHO_REVIEW_BATCH_MAX) {
    batches.push(valid.slice(start, start + ECHO_REVIEW_BATCH_MAX))
  }
  return { batches, invalid }
}
