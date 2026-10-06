import type { PickedMedia } from './pickedAssets'

/** A photo or video shot on the camera screen, on its way to a thread. */
export interface Snap {
  conversationId: string
  item: PickedMedia
  /** `null` sends it as an ordinary photo or video — the pill's "keep in chat". */
  viewOnce: { replay: boolean } | null
}

type Listener = (snap: Snap) => void

const listeners = new Map<string, Listener>()
const waiting: Snap[] = []

/**
 * Hands a snap to the thread it was shot for.
 *
 * The camera is a screen of its own, pushed over the thread, and the thread is
 * what knows how to send: the uploading row, the retry, the quota and the
 * media lock are all there, and a second copy of that in the camera would be
 * a second way for a send to fail differently. So the camera only says what
 * was shot and how, and goes back.
 *
 * Held until a listener exists rather than dropped: the thread is normally
 * still mounted underneath, but a narrow window on the web can redirect it,
 * and a photo somebody took and pressed Send on must not vanish.
 */
export function sendSnap(snap: Snap): void {
  const listener = listeners.get(snap.conversationId)
  if (listener) listener(snap)
  else waiting.push(snap)
}

/** The thread's side. Returns the unsubscribe. */
export function onSnap(conversationId: string, listener: Listener): () => void {
  listeners.set(conversationId, listener)
  for (let index = 0; index < waiting.length;) {
    const snap = waiting[index]
    if (snap?.conversationId === conversationId) {
      waiting.splice(index, 1)
      listener(snap)
    } else {
      index++
    }
  }
  return () => {
    // Only its own: a thread opened again replaces the listener before the
    // old screen's cleanup runs, and that cleanup must not remove the new one.
    if (listeners.get(conversationId) === listener) listeners.delete(conversationId)
  }
}
