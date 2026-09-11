import { focusManager, onlineManager } from '@tanstack/react-query'
import { addNetworkStateListener, getNetworkStateAsync } from 'expo-network'
import { AppState, Platform } from 'react-native'

/**
 * Tells TanStack Query what the phone's radio is doing.
 *
 * Both managers ship with browser defaults — `navigator.onLine` and
 * `visibilitychange` — neither of which exists on native, so on a phone the
 * library believed it was permanently online and permanently focused. Two
 * things followed. A query fired into a dead connection and sat there (nothing
 * in the fetch stack times out on its own), and a query that failed while the
 * app was in a tunnel was never retried on the way out of it: coming back to
 * the app refetched nothing, because nothing had told the library the app had
 * come back.
 *
 * With this, a query made while offline is *paused* rather than sent, and runs
 * the moment the network returns. The screens still have to say so — a paused
 * query looks exactly like a slow one — which is what `OfflineBanner` and
 * `listState`'s failed branch are for.
 *
 * Deliberately not on the web: the browser's own events are already right
 * there, and `document.visibilityState` is the better signal for a tab.
 */
export function configureQueryNetwork(): void {
  if (Platform.OS === 'web') return

  onlineManager.setEventListener((setOnline) => {
    /*
     * Only an explicit "no" counts as offline. `isInternetReachable` is
     * undefined until the OS has decided, and a first launch in a lift would
     * otherwise pause every query behind a guess. Pausing a query that could
     * have run is the worse of the two failures by a distance: the app looks
     * broken and nothing retries it until the next event.
     */
    const subscription = addNetworkStateListener((state) => {
      setOnline((state.isInternetReachable ?? state.isConnected) !== false)
    })
    return () => subscription.remove()
  })

  /*
   * The listener above only fires on a *change*, so an app opened with the
   * radio already off would start out believing it was online. One read at
   * startup is what closes that gap; a failure to read it leaves the default,
   * which is online, for the reason above.
   */
  void getNetworkStateAsync()
    .then((state) =>
      onlineManager.setOnline((state.isInternetReachable ?? state.isConnected) !== false),
    )
    .catch(() => undefined)

  focusManager.setEventListener((handleFocus) => {
    const subscription = AppState.addEventListener('change', (status) =>
      handleFocus(status === 'active'),
    )
    return () => subscription.remove()
  })
}
