import { queryFailed } from './listState'

/** A value that is not here yet, is here, or is not going to come. */
export type LoadState = 'loading' | 'ready' | 'unavailable'

/**
 * Where one value on a screen stands, for the places that used to write
 * `query.data?.n ?? 0`.
 *
 * That expression drew a zero for all three cases at once: a request still on
 * its way, a request that never arrived, and an account that really has none.
 * The first is a skeleton, the second a dash, and only the third is a `0` —
 * and it is the first one people watched, as a "0" that became "138" a moment
 * later.
 *
 * `data !== undefined`, not truthiness: a loaded zero, an empty list or an
 * empty string are all answers, and they must keep drawing themselves. Data
 * already in hand also outranks a failed refetch, as it does everywhere else
 * (`listState`, the `me` branch of the Me tab), which is what checking it first
 * says. Only with nothing to show does a refused or paused request stop being
 * "loading" — a skeleton that pulses for as long as the train is in the tunnel
 * is the thing `queryFailed` was written to prevent. Neither is a query that is
 * switched off, which has nothing coming at all.
 */
export function loadState(query: {
  data: unknown
  isError: boolean
  fetchStatus: string
}): LoadState {
  if (query.data !== undefined) return 'ready'
  if (queryFailed(query)) return 'unavailable'
  // Nothing on its way and nothing to show is a query that is switched off
  // (no handle to look up yet), not one that is loading: waiting for it would
  // be a skeleton that never leaves.
  return query.fetchStatus === 'fetching' ? 'loading' : 'unavailable'
}

/** What a number reads as when there is none. Not `0`, which is an answer. */
export const NO_NUMBER = '—'

/**
 * A count for a tile or a row, from a value that may not be here.
 *
 * `undefined` is the only thing that draws the dash — which covers a request
 * that failed and a field an older API does not send. Zero is a number and is
 * drawn: a new account has no corrections, and a tile that said "—" instead of
 * "0" would be telling it the app had lost its count.
 */
export function statText(
  value: number | undefined,
  format: (value: number) => string = String,
): string {
  return value === undefined ? NO_NUMBER : format(value)
}
