import { Observe } from 'expo-observe'

/**
 * Route and query parameter names that must never leave the device inside a
 * navigation metric.
 *
 * The `expo-router` integration tags every `cold_ttr` / `warm_ttr` / `tti`
 * event with the resolved `url` and *all* serializable params, and those events
 * are dispatched to EAS. `routeName` is a pattern (`/(app)/chat/[id]`) and is
 * never affected, so filtering costs nothing but the ability to tell two
 * sessions on the same route apart — which is the point.
 *
 * Naming even one of these in an event replaces `url` with `urlHidden: true`,
 * so the resolved path goes as well. That is deliberate: `/reset-password` with
 * the token stripped from `routeParams` but still sitting in the path would
 * have leaked it anyway.
 *
 * Three kinds of thing are listed, and only these three:
 *
 *  - **credentials** — `token` is a live password-reset token and `code` /
 *    `user_code` are the device-linking codes, all three of which grant
 *    something to whoever holds them;
 *  - **identity** — `email`, `handle`, `username` and `userId` name a person,
 *    and a metric stream is not a place to build a list of who uses the app;
 *  - **content ids** — `id`, `targetId` and `at` point at one conversation,
 *    post or message. Innocuous alone, but "this account was in this chat" is
 *    exactly the sort of thing that should not be reconstructable from a
 *    performance dataset.
 *
 * Anything not listed here (`tab`, `from`, `feature`, `invite`, `error`,
 * `targetType`) is a fixed vocabulary with no per-person value, and those are
 * the params actually worth having when a route turns out to be slow.
 */
export const OBSERVE_FILTERED_PARAMS = [
  'at',
  'code',
  'email',
  'handle',
  'id',
  'targetId',
  'token',
  'user_code',
  'userId',
  'username',
] as const

/**
 * Turns on EAS Observe's `expo-router` integration.
 *
 * **Must be called at module scope, before anything mounts.** The provider
 * inside `ObserveRoot` reads the flag once when it mounts and throws if the
 * answer changes afterwards, so this cannot move into an effect.
 *
 * With the integration on, `cold_ttr` and `warm_ttr` are recorded for every
 * route by a listener on the router's own navigation events — no per-screen
 * code. `tti` is the one that needs asking for: see `useScreenInteractive`.
 *
 * A no-op on web, where `expo-observe`'s shim discards the config and
 * `useObserve()` falls back to the app-wide `markInteractive`.
 */
export function configureObserve(): void {
  Observe.configure({
    integrations: {
      'expo-router': { filteredParams: [...OBSERVE_FILTERED_PARAMS] },
    },
  })
}
