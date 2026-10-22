import { ECHO_REVIEW_BATCH_MAX } from '@langx/shared'
import { describe, expect, it } from 'vitest'
import { pendingBatches } from './echoPendingBatches'
import type { PendingReview } from './echoSnapshot'

const AT = '2026-09-14T12:00:00.000Z'

function pending(n: number): PendingReview {
  return { reviewId: `review-${n}`, cardId: `c-${n}`, grade: 'good', durationMs: 900, at: AT }
}

describe('sending the grades a device kept', () => {
  /*
   * Ten sessions on a train is a hundred and ten grades, and the server takes
   * a hundred a request. Sent as one, the whole lot was refused every time
   * the tab opened, and every session after added to it.
   */
  it('never asks the server for more than one batch holds', () => {
    const all = Array.from({ length: ECHO_REVIEW_BATCH_MAX * 2 + 5 }, (_, n) => pending(n))
    const { batches } = pendingBatches(all)
    expect(batches.map((batch) => batch.length)).toEqual([
      ECHO_REVIEW_BATCH_MAX,
      ECHO_REVIEW_BATCH_MAX,
      5,
    ])
    expect(batches.flat().map((review) => review.reviewId)).toEqual(all.map((p) => p.reviewId))
  })

  it('sends only what the request carries, not when it was given', () => {
    const { batches } = pendingBatches([pending(1)])
    expect(batches[0]?.[0]).toEqual({
      reviewId: 'review-1',
      cardId: 'c-1',
      grade: 'good',
      durationMs: 900,
    })
  })

  /*
   * The server validates the body as a whole, so one entry it can never
   * accept — a file from an older build, a grade name since retired — failed
   * every request it rode in, and the good grades beside it with it.
   */
  it('sets aside an entry the server could never accept', () => {
    const broken = [
      { ...pending(2), reviewId: 'short' },
      { ...pending(3), grade: 'perfect' },
      { ...pending(4), durationMs: Number.NaN },
      { ...pending(5), cardId: '' },
    ] as PendingReview[]
    const { batches, invalid } = pendingBatches([pending(1), ...broken, pending(6)])
    expect(batches.flat().map((review) => review.reviewId)).toEqual(['review-1', 'review-6'])
    expect(invalid.map((review) => review.reviewId)).toEqual(broken.map((p) => p.reviewId))
  })

  it('sends nothing when nothing is waiting', () => {
    expect(pendingBatches([])).toEqual({ batches: [], invalid: [] })
  })
})
