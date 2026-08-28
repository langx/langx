export type ListState = 'skeleton' | 'empty' | 'content'

/**
 * What a list should draw right now.
 *
 * One place rather than a condition per screen, because the interesting case
 * is not the first load: an infinite query fetching page two is `isFetching`
 * with items already on screen, and a refetch after an error is `isPending`
 * with nothing. Only `isPending` — no data for this query key at all — is a
 * skeleton; anything else with rows is content, and the caller's empty state
 * gets the rest.
 */
export function listState(input: {
  isPending: boolean
  isError: boolean
  itemCount: number
}): ListState {
  if (input.itemCount > 0) return 'content'
  if (input.isPending && !input.isError) return 'skeleton'
  return 'empty'
}
