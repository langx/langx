/**
 * The two pictures of a call — this device's camera and the other person's —
 * for whatever is drawing them.
 *
 * Apart from `store.ts` on purpose. That one holds plain facts a reducer can
 * be tested on; these are live media objects, opaque to everything but the
 * engine that made them and the view that shows them, and they change on
 * their own schedule: a camera turned on mid-call swaps a track without
 * anything about the call's state moving.
 */
export interface CallStreams {
  local: unknown
  remote: unknown
  /** Bumped whenever a track is added or removed, so a view knows to look again. */
  revision: number
}

let streams: CallStreams = { local: null, remote: null, revision: 0 }
const listeners = new Set<() => void>()

export function callStreams(): CallStreams {
  return streams
}

export function subscribeToCallStreams(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function setCallStreams(next: { local?: unknown; remote?: unknown }): void {
  streams = { ...streams, ...next, revision: streams.revision + 1 }
  for (const listener of listeners) listener()
}

export function resetCallStreams(): void {
  setCallStreams({ local: null, remote: null })
}
