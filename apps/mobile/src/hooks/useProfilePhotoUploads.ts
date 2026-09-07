import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { addPhotoWithProgress, keys, type MeProfile } from '../api/queries'
import {
  advanceUpload,
  sameDisplayedProgress,
  UPLOAD_START,
  uploadFailed,
  uploadSent,
  type UploadProgress,
} from '../lib/uploadProgress'

/** A photo the gallery is holding on screen before the server has it. */
export interface PendingPhoto {
  id: string
  uri: string
  contentType: string
  progress: UploadProgress
}

let nextId = 1

/**
 * The profile gallery's uploads: several photos, one at a time, drawn as they go.
 *
 * **Sequential, but the queue stays open.** `fetch(uri).blob()` reads a whole
 * file into memory before a byte is sent, so starting six at once is six
 * pictures in RAM on the tightest memory budget a phone has — the same reason
 * `usePostAttachments` uploads a composer's files in a row. What is different
 * here is that picking is not a submit: somebody can add another photo while
 * one is still going up, and it joins the queue rather than being refused. The
 * screen used to disable its "+" for the duration, which is why a second photo
 * could not be added at all.
 *
 * Progress is per file, not per batch. A batch percentage would need a
 * denominator nobody has until every blob has been read.
 */
export function useProfilePhotoUploads(onError: (caught: unknown) => void) {
  const queryClient = useQueryClient()
  const [pending, setPending] = useState<PendingPhoto[]>([])
  /** The queue as the driver sees it; state is only what the grid draws. */
  const queue = useRef<PendingPhoto[]>([])
  const running = useRef(false)

  // Read through a ref so the driver, which outlives a render, always calls
  // the current handler rather than the one captured when it started.
  const errorHandler = useRef(onError)
  useEffect(() => {
    errorHandler.current = onError
  })

  function patch(id: string, progress: UploadProgress): void {
    setPending((current) =>
      current.map((photo) =>
        photo.id === id && !sameDisplayedProgress(photo.progress, progress)
          ? { ...photo, progress }
          : photo,
      ),
    )
  }

  async function drain(): Promise<void> {
    if (running.current) return
    running.current = true
    try {
      for (;;) {
        const next = queue.current[0]
        if (!next) return
        patch(next.id, UPLOAD_START)
        try {
          const profile = await addPhotoWithProgress({
            uri: next.uri,
            contentType: next.contentType,
            onProgress: (loaded, total) =>
              setPending((current) =>
                current.map((photo) =>
                  photo.id === next.id
                    ? { ...photo, progress: advanceUpload(photo.progress, loaded, total) }
                    : photo,
                ),
              ),
          })
          patch(next.id, uploadSent(UPLOAD_START))
          queue.current = queue.current.filter((photo) => photo.id !== next.id)
          // The placeholder goes only once the real photo is in `keys.me`, so
          // the tile is never absent for a frame between the two.
          queryClient.setQueryData<MeProfile>(keys.me, profile)
          setPending((current) => current.filter((photo) => photo.id !== next.id))
        } catch (caught) {
          // Left on screen, marked failed, and out of the queue so one bad
          // file does not stall the ones behind it.
          queue.current = queue.current.filter((photo) => photo.id !== next.id)
          setPending((current) =>
            current.map((photo) =>
              photo.id === next.id ? { ...photo, progress: uploadFailed(photo.progress) } : photo,
            ),
          )
          errorHandler.current(caught)
        }
      }
    } finally {
      running.current = false
    }
  }

  function add(picked: readonly { uri: string; contentType: string }[]): void {
    if (picked.length === 0) return
    const added = picked.map((item) => ({
      id: `photo-${nextId++}`,
      uri: item.uri,
      contentType: item.contentType,
      progress: UPLOAD_START,
    }))
    queue.current = [...queue.current, ...added]
    setPending((current) => [...current, ...added])
    void drain()
  }

  /**
   * Retries or forgets a tile that failed. Only a failed one: a tile still in
   * the queue has an upload behind it that these could not call off, and a
   * "cancelled" photo that arrived anyway is worse than no cancel button.
   */
  function retry(id: string): void {
    const photo = pending.find((item) => item.id === id)
    if (photo?.progress.phase !== 'failed') return
    queue.current = [...queue.current, { ...photo, progress: UPLOAD_START }]
    patch(id, UPLOAD_START)
    void drain()
  }

  function discard(id: string): void {
    setPending((current) =>
      current.filter((photo) => photo.id !== id || photo.progress.phase !== 'failed'),
    )
  }

  return { pending, add, retry, discard }
}
