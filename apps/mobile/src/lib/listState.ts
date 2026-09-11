export type ListState = 'skeleton' | 'empty' | 'failed' | 'content'

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
 * `'failed'` used to be folded into `'empty'`, which meant every screen told
 * somebody whose request never arrived that there was nothing to see: "Nobody
 * here yet", "No chats yet", with a button offering to go and start one.
 * Discovery wrote the branch by hand first (#1314); it is here now because
 * six other screens had the same defect and a variant nobody can forget to
 * handle is the only way that stays fixed.
 *
 * `isPaused` is the same news arriving a different way. With `onlineManager`
 * wired to the radio (`lib/queryNetwork.ts`), a query made with no network is
 * never sent — it waits — so it is `isPending` forever with no error to show,
 * which is a skeleton that pulses until the train leaves the tunnel.
 */
export function listState(input: {
  isPending: boolean
  isError: boolean
  itemCount: number
  /** `query.fetchStatus === 'paused'`: waiting for a network that is not there. */
  isPaused?: boolean
}): ListState {
  if (input.itemCount > 0) return 'content'
  if (input.isError || input.isPaused) return 'failed'
  if (input.isPending) return 'skeleton'
  return 'empty'
}
