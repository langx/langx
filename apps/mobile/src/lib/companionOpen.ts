/**
 * Which companion surface opened the app, read from the link it opened with.
 *
 * Phase 7 of `docs/plans/iphone-watch-and-carplay.md` is a question, not a
 * build: is the Live Activity looked at enough to pay for a second push path
 * (direct APNs) that could keep it live from the server? The plan's answer is
 * to measure the phone-driven activity that already ships before paying for
 * anything, and this is the measuring half — the other half is
 * `live_activity_started` in `useExchangeActivity`.
 *
 * It works from the URL alone because each surface already links in a shape
 * of its own, and nothing else in the app produces them:
 *
 * - `langx:///chats/<id>` — only the Live Activity (`ExchangeLiveActivity`),
 *   which links to the call's conversation;
 * - `langx:///me`, `langx:///chats`, `langx:///echo` — only the widgets, on
 *   both platforms.
 *
 * The triple slash matters: it is how the native surfaces spell the scheme,
 * and a universal link or a shared `https://` URL never looks like it. The
 * conversation id is deliberately not returned — which call was opened is not
 * the question, and an id is one more thing an analytics event need not hold.
 */
export type CompanionOpen =
  | { source: 'live_activity'; target: 'chat' }
  | { source: 'widget'; target: 'me' | 'chats' | 'echo' }

export function companionOpenFromUrl(url: string | null | undefined): CompanionOpen | null {
  if (!url) return null
  const match = /^langx:\/\/\/([a-z]+)(?:\/([a-f\d]{1,64}))?\/?(?:[?#].*)?$/.exec(url)
  if (!match) return null
  const [, section, id] = match

  if (section === 'chats' && id !== undefined) return { source: 'live_activity', target: 'chat' }
  if (id !== undefined) return null
  if (section === 'me' || section === 'chats' || section === 'echo') {
    return { source: 'widget', target: section }
  }
  return null
}
