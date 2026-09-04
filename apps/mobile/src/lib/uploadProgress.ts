/**
 * What "uploading" means to somebody watching it.
 *
 * Three phases rather than one number, because the first of them has no number
 * to give: `fetch(uri).blob()` reads the whole file into memory before a single
 * byte is sent, and on a 4 MB photo that is a real pause. Reporting 0% through
 * it would be a lie that looks like a stall; saying "preparing" is the truth.
 *
 * Pure, so the tests can reach it — `putWithProgress` cannot be tested here,
 * there is no `XMLHttpRequest` in the test environment.
 */
export type UploadPhase = 'reading' | 'uploading' | 'sending' | 'failed'

export interface UploadProgress {
  phase: UploadPhase
  /** 0–1, and only meaningful while `phase` is `uploading`. */
  fraction: number
}

export const UPLOAD_START: UploadProgress = { phase: 'reading', fraction: 0 }

/** Clamped, and never allowed to run backwards — a retried chunk is not progress lost. */
export function advanceUpload(
  current: UploadProgress,
  loaded: number,
  total: number,
): UploadProgress {
  if (current.phase === 'failed' || current.phase === 'sending') return current
  if (!Number.isFinite(loaded) || !Number.isFinite(total) || total <= 0) {
    return { phase: 'uploading', fraction: current.fraction }
  }
  const next = Math.min(1, Math.max(0, loaded / total))
  return { phase: 'uploading', fraction: Math.max(current.fraction, next) }
}

/**
 * The bytes are up; what is left is the socket round-trip that turns them into
 * a message. Pinned at 1 so the bar does not sit at 97% while it waits.
 */
export function uploadSent(current: UploadProgress): UploadProgress {
  if (current.phase === 'failed') return current
  return { phase: 'sending', fraction: 1 }
}

export function uploadFailed(current: UploadProgress): UploadProgress {
  return { phase: 'failed', fraction: current.fraction }
}

/** Whole percent, for the label. Rounded down so it never reads 100 before it is. */
export function percentOf(progress: UploadProgress): number {
  return Math.floor(progress.fraction * 100)
}

/**
 * Whether two progresses would draw the same thing.
 *
 * `XMLHttpRequest` fires a progress event per chunk — dozens a second on a
 * video — and each one used to `setState` on the screen that owns the feed's
 * `FlatList`, re-rendering every visible post to move a label that shows whole
 * percents and often had not changed at all. The label is the only reader, so
 * this is what "changed" means to it.
 */
export function sameDisplayedProgress(a: UploadProgress, b: UploadProgress): boolean {
  return a.phase === b.phase && percentOf(a) === percentOf(b)
}

/**
 * Which of a composer's attachments is in flight, and how far along.
 *
 * The feed uploads its files one at a time on submit — a batch percentage
 * would need a denominator nobody has, because each blob's size is only known
 * once it has been read. So the row reports per file and fills up left to
 * right, which is true the whole way.
 */
export interface ActiveUpload {
  index: number
  progress: UploadProgress
}

/**
 * What to draw over one thumbnail: `null` leaves the picture alone, anything
 * else is a scrim. Files already sent read as finished rather than reverting
 * to untouched, so the row itself shows the batch's progress.
 */
export function thumbProgress(index: number, active: ActiveUpload | null): UploadProgress | null {
  if (!active) return null
  if (index < active.index) return { phase: 'sending', fraction: 1 }
  if (index > active.index) return null
  return active.progress
}
