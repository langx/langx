import { onlineManager } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useSubmitEchoReviews } from '../api/queries'
import { pendingBatches } from '../lib/echoPendingBatches'
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
  // The function alone: the mutation object is new on every state change, and
  // an effect keyed on it re-sent a refused queue as fast as it was refused.
  const { mutateAsync: send } = useSubmitEchoReviews()

  useEffect(() => {
    void readEchoSnapshot().then(setSaved)
  }, [])

  // Keep the counts fresh whenever the server has answered.
  useEffect(() => {
    if (summary) void rememberEchoSummary(summary as EchoSnapshot['summary'])
  }, [summary])

  /*
   * One flush at a time. The mutation's own `isPending` drops between two
   * batches, and the effect re-runs on that render with the file not yet
   * re-read — so it started a second flush of everything still listed.
   */
  const flushing = useRef(false)

  useEffect(() => {
    const pending = saved?.pending ?? []
    if (pending.length === 0 || !onlineManager.isOnline() || flushing.current) return
    flushing.current = true

    /*
     * The ids were minted when each grade was given, so these are the same
     * idempotent batches the session would have sent. Anything the server has
     * already applied comes back `duplicate` and is dropped from the file
     * either way — what matters is that it stops being pending.
     *
     * In batches, and in order, each forgotten as it lands: see
     * `pendingBatches` for the two ways one request for everything stuck.
     */
    const { batches, invalid } = pendingBatches(pending)
    void (async () => {
      try {
        await forgetPendingReviews(invalid)
        for (const reviews of batches) {
          await send({ reviews })
          await forgetPendingReviews(reviews)
        }
        flushing.current = false
        // Re-read, which also picks up anything a session added meanwhile.
        setSaved(await readEchoSnapshot())
      } catch {
        // Still no network, or the server is unwell. The file keeps the rest
        // for the next time the tab opens; retrying here would only spin.
        flushing.current = false
      }
    })()
  }, [saved, send])

  return { saved }
}
