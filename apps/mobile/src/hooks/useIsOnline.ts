import { onlineManager } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'

/**
 * Whether the phone has a network, as far as anything here can tell.
 *
 * Read from TanStack Query's `onlineManager` rather than from `expo-network`
 * directly, so that what the banner says and what the queries do can never
 * disagree: `lib/queryNetwork.ts` is the one place that decides, and this is a
 * view of it.
 *
 * The third argument is the answer during the web build's prerender, where
 * there is no network to ask about and no viewer to tell.
 */
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => onlineManager.subscribe(() => onStoreChange()),
    () => onlineManager.isOnline(),
    () => true,
  )
}
