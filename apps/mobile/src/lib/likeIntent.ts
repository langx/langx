/**
 * The heart's optimistic state, kept apart from the button so it can be tested.
 *
 * `useSetLike` patches the caches only once the server has answered, so a
 * heart drawn from its props waited a round trip to fill — the delay the
 * whole tap is about. The button now draws what the person asked for
 * (`desired`) and lets the props take over again once they agree.
 *
 * One request at a time. Taps while one is in flight only move `desired`; when
 * the request settles, a `desired` that no longer matches what the server
 * just recorded is sent once more. So a like-unlike-like burst costs at most
 * two requests and always ends where the last tap left it, with no request
 * racing another to be the one the server keeps.
 */
export interface LikeIntent {
  /** What the person last asked for, or `null` to follow the props. */
  desired: boolean | null
  /** A request is out; the next tap waits for it. */
  inFlight: boolean
}

export const IDLE_LIKE: LikeIntent = { desired: null, inFlight: false }

/** What the next step should send, or `null` to send nothing. */
export interface LikeStep {
  intent: LikeIntent
  send: boolean | null
}

/** Whether the heart is drawn liked. */
export function shownLiked(intent: LikeIntent, serverLiked: boolean): boolean {
  return intent.desired ?? serverLiked
}

/** The count beside it: the props' count, moved by the one like the props do not know about yet. */
export function shownCount(intent: LikeIntent, serverLiked: boolean, serverCount: number): number {
  const liked = shownLiked(intent, serverLiked)
  if (liked === serverLiked) return serverCount
  return Math.max(0, serverCount + (liked ? 1 : -1))
}

/** A tap on the heart. */
export function tapLike(intent: LikeIntent, serverLiked: boolean): LikeStep {
  const desired = !shownLiked(intent, serverLiked)
  if (intent.inFlight) return { intent: { desired, inFlight: true }, send: null }
  return { intent: { desired, inFlight: true }, send: desired }
}

/**
 * The request came back: `recorded` is what the server now holds, or `null`
 * when it failed. A failure drops the wish, so the heart springs back to the
 * props — and `useSetLike`'s error toast says why.
 */
export function settleLike(intent: LikeIntent, recorded: boolean | null): LikeStep {
  if (recorded === null) return { intent: IDLE_LIKE, send: null }
  if (intent.desired !== null && intent.desired !== recorded) {
    return { intent: { desired: intent.desired, inFlight: true }, send: intent.desired }
  }
  return { intent: { desired: intent.desired, inFlight: false }, send: null }
}

/**
 * Hand back to the props once they agree and nothing is out. Called with each
 * new prop value; returns the same object when nothing changes, so a render
 * can compare by identity.
 */
export function catchUpLike(intent: LikeIntent, serverLiked: boolean): LikeIntent {
  if (intent.inFlight || intent.desired === null || intent.desired !== serverLiked) return intent
  return IDLE_LIKE
}
