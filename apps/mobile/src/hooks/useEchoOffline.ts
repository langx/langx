import { onlineManager } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useSubmitEchoReviews } from '../api/queries'
import type { EchoSnapshot } from '../lib/echoSnapshot'
import { forgetPendingReviews, readEchoSnapshot, rememberEchoSummary } from '../lib/echoStore'

/**
 * The tab's half of working without a network.
 *
 * Two jobs, and they are together because they read the same file: hand back
 * the counts saved on the device so the screen is not blank on a train, and
 * send whatever was graded while it was.
 *
 * The send is here rather than in the session screen because the session is
 * where grades are *made* and this is where somebody returns. A person who
 * answered ten cards in a tunnel and closed the app has their work in a file;
 * the next time they open the tab with a network, it goes.
 */
export function useEchoOffline(summary: { total: number } | undefined): {
  saved: EchoSnapshot | null
} {
  const [saved, setSaved] = useState<EchoSnapshot | null>(null)
  const submit = useSubmitEchoReviews()

  useEffect(() => {
    void readEchoSnapshot().then(setSaved)
  }, [])

  // Keep the counts fresh whenever the server has answered.
  useEffect(() => {
    if (summary) void rememberEchoSummary(summary as EchoSnapshot['summary'])
  }, [summary])

  useEffect(() => {
    const pending = saved?.pending ?? []
    if (pending.length === 0 || !onlineManager.isOnline() || submit.isPending) return

    /*
     * The ids were minted when each grade was given, so this is the same
     * idempotent batch the session would have sent. Anything the server has
     * already applied comes back `duplicate` and is dropped from the file
     * either way — what matters is that it stops being pending.
     */
    void submit
      .mutateAsync({
        reviews: pending.map(({ reviewId, cardId, grade, durationMs }) => ({
          reviewId,
          cardId,
          grade,
          durationMs,
        })),
      })
      .then(async () => {
        await forgetPendingReviews(pending.map((item) => item.reviewId))
        setSaved(await readEchoSnapshot())
      })
      .catch(() => {
        // Still no network, or the server is unwell. The file keeps them.
      })
  }, [saved, submit])

  return { saved }
}
