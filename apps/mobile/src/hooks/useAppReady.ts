import { useEffect } from 'react'
import { useSyncExternalStore } from 'react'
import { isAppReady, markAppReady, subscribeToAppReady } from '../lib/appReady'

/**
 * The third argument is not optional here: `expo export --platform web` runs
 * with `output: 'static'`, so this renders during prerender, where there is no
 * store to subscribe to.
 */
export function useAppReady(): boolean {
  return useSyncExternalStore(subscribeToAppReady, isAppReady, isAppReady)
}

/**
 * Says the app is ready once `when` becomes true.
 *
 * In an effect and never during render: `markAppReady` notifies its
 * subscribers, and doing that mid-render sets state inside another component's
 * render pass. The effect still lands in the same commit as the `<Redirect>`
 * these screens return, which is the moment that actually matters.
 */
export function useSignalAppReady(when: boolean): void {
  useEffect(() => {
    if (when) markAppReady()
  }, [when])
}
