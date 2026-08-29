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

/**
 * Open the thread on a post — the sentence and every correction of it.
 *
 * The cast is the same one `openProfile` needs and for the same reason
 * `backHref` documents: `Href` is a union of generated route literals once
 * `expo start` has written them and a loose string when it has not, so the
 * assertion is required locally and redundant in CI. Doing it in one place per
 * destination is what keeps that from being a per-call-site decision.
 */
export function openPost(postId: string, from: string): void {
  router.push(`/(app)/post/${postId}?from=${encodeURIComponent(from)}` as Href)
}

/** Who liked one post or one correction. */
export function openLikers(targetType: string, targetId: string, from: string): void {
  router.push(
    `/(app)/likes?targetType=${targetType}&targetId=${targetId}&from=${encodeURIComponent(from)}` as Href,
  )
}
