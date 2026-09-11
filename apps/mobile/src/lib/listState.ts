export type ListState = 'skeleton' | 'failed' | 'empty' | 'content'

/**
 * What a list should draw right now.
 *
 * One place rather than a condition per screen, because the interesting case
 * is not the first load: an infinite query fetching page two is `isFetching`
 * with items already on screen, and a refetch after an error is `isPending`
 * with nothing. Only `isPending` — no data for this query key at all — is a
 * skeleton; anything else with rows is content, and the caller's empty state
 * gets the rest.
 *
 * `'failed'` was folded into `'empty'` once, and every caller then drew its
 * empty state over a request that never arrived: a timeout said nobody matched
 * your languages, that every post was already corrected, that you had no chats.
 * Those are opposite news and only one of them is the reader's to act on, so
 * the distinction lives here rather than in a condition each screen has to
 * remember to write — which is exactly what all seven of them forgot.
 *
 * `isPaused` is the same news arriving a beat earlier. With `onlineManager`
 * wired to the radio (`lib/queryNetwork.ts`) a query made with no network is
 * never sent — it waits — so it stays `isPending` with no error to show, which
 * is a skeleton that pulses until the train leaves the tunnel.
 */
export function listState(input: {
  isPending: boolean
  isError: boolean
  itemCount: number
  /** `query.fetchStatus === 'paused'`: waiting for a network that is not there. */
  isPaused?: boolean
}): ListState {
  // Rows outrank everything below, so a failed *second* page leaves the list
  // that is already on screen alone.
  if (input.itemCount > 0) return 'content'
  if (input.isError || input.isPaused) return 'failed'
  if (input.isPending) return 'skeleton'
  return 'empty'
}

/**
 * A query that is not going to answer: it failed, or it is waiting for a
 * network that is not there.
 *
 * The second half only exists because `onlineManager` is wired to the radio
 * now (`lib/queryNetwork.ts`). Pausing is the right behaviour — the request
 * runs by itself when the phone is back — but to a screen it looks exactly
 * like a first load that is taking its time, and "taking its time" is drawn as
 * a skeleton, forever. Every screen that draws a `LoadFailed` has to ask this
 * rather than `isError`, which is why it is one function and not six
 * conditions.
 */
export function queryFailed(query: { isError: boolean; fetchStatus: string }): boolean {
  return query.isError || query.fetchStatus === 'paused'
}
