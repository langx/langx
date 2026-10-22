/**
 * How long People's skeleton waits for the strips above the list.
 *
 * The Boosted and "New on LangX" strips sit in the list's header, and used to
 * be fetched only once the list had left its skeleton — so the cards drew,
 * and then moved down 150–250 pt when the strips answered. Now the strips are
 * asked for alongside the list, and the skeleton stays until they have
 * answered too, but never for longer than this past the list's own answer: a
 * slow strip is not worth holding the cards for. A strip that misses the cap
 * fades in where it lands rather than appearing in one frame.
 */
export const STRIP_HOLD_MS = 400

/** The fields of a TanStack query this reads. */
export interface StripQuery {
  enabled: boolean
  isPending: boolean
  fetchStatus: string
}

/**
 * Whether a strip's query has said anything it is going to say for now: it
 * answered or failed, or it was never asked (a sort the strip is not on), or
 * it is waiting for a network that is not there — which it would wait for
 * forever.
 */
export function stripSettled(query: StripQuery): boolean {
  return !query.enabled || !query.isPending || query.fetchStatus === 'paused'
}

/**
 * Whether this mount's list still has its first load ahead of it.
 *
 * `loading`: the list started on its skeleton and has not been shown yet, so
 * its first appearance may be held for the strips. `done`: it has been shown,
 * or it was drawn from the cache on the first render. A list that has been
 * shown is never held again — a strip refetching under a new sort or filter
 * would otherwise send the whole list back to its skeleton — and a cached
 * list never waited for anything in the first place.
 */
export type StripHoldPhase = 'loading' | 'done'

export function firstStripHoldPhase(startsOnSkeleton: boolean): StripHoldPhase {
  return startsOnSkeleton ? 'loading' : 'done'
}

/**
 * Whether the skeleton is still standing in for a list that has already
 * answered. `capped` is the hold's timer having run out; `firstLoad` is the
 * phase above being `loading`.
 */
export function holdForStrips({
  firstLoad,
  listReady,
  stripsSettled,
  capped,
}: {
  firstLoad: boolean
  listReady: boolean
  stripsSettled: boolean
  capped: boolean
}): boolean {
  return firstLoad && listReady && !stripsSettled && !capped
}
