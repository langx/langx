import { router, type Href } from 'expo-router'
import { backHref } from './backHref'
import { profileHref } from './profileHref'

/** Go to this screen's parent. See `backHref` for why it is not `router.back()`. */
export function goBackTo(fallback: Href, from?: string): void {
  router.replace(backHref(from, fallback))
}

/** Open somebody's profile, remembering where to come back to. */
export function openProfile(handle: string, from: string): void {
  router.push(profileHref(handle, from) as Href)
}
