import { useState } from 'react'
import { uploadPostMedia } from '../api/queries'
import type { PendingAttachment } from '../components/AttachmentBar'
import { advanceUpload, UPLOAD_START, uploadSent, type ActiveUpload } from '../lib/uploadProgress'

/**
 * Uploads a composer's attachments on submit, reporting one file at a time.
 *
 * **On submit, not when they were picked.** Picking is not committing:
 * uploading then would spend a day's media quota on files the writer went on
 * to remove, and would start several large reads at once on the tightest
 * memory budget a phone has. That is also what makes a per-file percentage the
 * honest thing to show — the batch's total is not known until the last blob
 * has been read.
 *
 * A hook rather than a function because the progress belongs with it, and
 * because there are now two composers: the feed's correction box and the
 * `compose` route. They cannot both be sending, but they are no longer on the
 * same screen, so they can no longer share one piece of state.
 */
export function usePostAttachments() {
  const [progress, setProgress] = useState<ActiveUpload | null>(null)

  async function attach(pending: readonly PendingAttachment[]) {
    if (pending.length === 0) return undefined
    const uploaded = []
    try {
      for (const [index, item] of pending.entries()) {
        setProgress({ index, progress: UPLOAD_START })
        uploaded.push(
          await uploadPostMedia({
            ...item,
            onProgress: (loaded, total) =>
              setProgress((current) =>
                current && current.index === index
                  ? { index, progress: advanceUpload(current.progress, loaded, total) }
                  : current,
              ),
          }),
        )
        setProgress({ index, progress: uploadSent(UPLOAD_START) })
      }
    } finally {
      // Cleared on the way out either way: a failure leaves the files in the
      // row with their crosses back, which is what a retry needs.
      setProgress(null)
    }
    return uploaded
  }

  return { attach, progress }
}
