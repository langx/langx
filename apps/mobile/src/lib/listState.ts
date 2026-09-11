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
 */
export function listState(input: {
  isPending: boolean
  isError: boolean
  itemCount: number
}): ListState {
  // Rows outrank everything below, so a failed *second* page leaves the list
  // that is already on screen alone.
  if (input.itemCount > 0) return 'content'
  if (input.isError) return 'failed'
  if (input.isPending) return 'skeleton'
  return 'empty'
}
