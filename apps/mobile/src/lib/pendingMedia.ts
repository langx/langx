import { UPLOAD_START, type UploadProgress } from './uploadProgress'

/**
 * Attachments that have been picked but are not yet messages.
 *
 * Before this, sending a photo did nothing visible: `sendingMedia` disabled two
 * buttons and the thread was unchanged until the socket echoed the finished
 * message back. On a slow connection with a 4 MB photo that is many seconds of
 * a screen that looks like it ignored the tap — and if the upload failed, an
 * alert appeared and the picked file was simply thrown away.
 *
 * A pure module for the reason `unsentMessages` is: vitest only sees
 * `src/lib/**`, and this logic inside the chat screen would never be tested.
 * It is a sibling of that queue in shape as well as in purpose — the two are
 * rendered next to each other, above the composer.
 *
 * Not written into the message cache. `appendIncomingMessage` dedupes on `_id`,
 * a minted one would collide with `applyMessageUpdate` and `applyDeliveredAt`,
 * and the jump-window guard makes cache insertion depend on which mode the
 * thread happens to be in.
 */
export interface PendingMedia {
  /** Client-minted, so the row exists before the server has given it an id. */
  clientId: string
  conversationId: string
  kind: 'image' | 'audio' | 'video'
  /** The local `file://` the picker returned. `ImageBubble` draws it as-is. */
  uri: string
  contentType: string
  width?: number
  height?: number
  durationSeconds?: number
  /**
   * Every file this row is uploading, when there is more than one.
   *
   * The row is one message, not one file — a gallery arrives as a single
   * bubble — so it shows the first picture and says how many are behind it.
   * A retry needs the whole set, which is the other reason it is kept.
   */
  files?: {
    uri: string
    contentType: string
    kind: 'image' | 'audio' | 'video'
    width?: number
    height?: number
    durationSeconds?: number
  }[]
  progress: UploadProgress
  startedAt: string
}

/**
 * A ceiling. Nothing should ever queue this many — sends are serialised — but
 * a leak here would grow the thread without bound, and the oldest entry is the
 * one whose ack is least likely to still be coming.
 */
export const MAX_PENDING_MEDIA = 8

export function addPending(
  list: readonly PendingMedia[],
  item: Omit<PendingMedia, 'progress' | 'startedAt'>,
  now: Date,
): PendingMedia[] {
  const next: PendingMedia = { ...item, progress: UPLOAD_START, startedAt: now.toISOString() }
  return [...list, next].slice(-MAX_PENDING_MEDIA)
}

export function updatePending(
  list: readonly PendingMedia[],
  clientId: string,
  progress: UploadProgress,
): PendingMedia[] {
  return list.map((item) => (item.clientId === clientId ? { ...item, progress } : item))
}

export function removePending(list: readonly PendingMedia[], clientId: string): PendingMedia[] {
  return list.filter((item) => item.clientId !== clientId)
}

/**
 * Anything still pending after this is not coming back.
 *
 * The socket ack is what normally retires a row — `sendMediaMessageSchema` has
 * no `clientId`, so the echoed message cannot be matched to the attempt that
 * made it. An ack lost to a dropped connection would otherwise leave a bubble
 * uploading forever.
 */
export const PENDING_MEDIA_STALE_MS = 90_000

export function expirePending(
  list: readonly PendingMedia[],
  now: Date,
  staleMs: number = PENDING_MEDIA_STALE_MS,
): PendingMedia[] {
  return list.map((item) => {
    if (item.progress.phase === 'failed') return item
    const age = now.getTime() - new Date(item.startedAt).getTime()
    if (age < staleMs) return item
    return { ...item, progress: { phase: 'failed', fraction: item.progress.fraction } }
  })
}

export function newPendingId(): string {
  return `pending-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
