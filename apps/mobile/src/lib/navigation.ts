import { router, type Href } from 'expo-router'
import { backHref } from './backHref'

/** Go to this screen's parent. See `backHref` for why it is not `router.back()`. */
export function goBackTo(fallback: Href, from?: string): void {
  router.replace(backHref(from, fallback))
}
