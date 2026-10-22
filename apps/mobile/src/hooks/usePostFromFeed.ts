import { useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import type { FeedPost } from '../api/types'
import { findFeedPost } from '../lib/postFromFeed'

/**
 * The post as the feed already holds it, for a post screen to draw its header
 * from while its own request is in flight — opening a card used to show a
 * skeleton for a post that was on screen a moment before.
 *
 * Read from every list cached under `['feed']` (the timeline, "My posts"),
 * once per `postId`. A snapshot, not a subscription: it stands in only until
 * the screen's own query answers with the post, which then wins, and running
 * a lookup over every feed page on every cache event in the app would cost
 * more than the stand-in is worth. `undefined` on a cold deep link, or for a
 * post no loaded feed page holds.
 *
 *     const fromFeed = usePostFromFeed(id)
 *     const post = query.data?.pages[0]?.post ?? fromFeed
 */
export function usePostFromFeed(postId: string): FeedPost | undefined {
  const client = useQueryClient()
  return useMemo(
    () => findFeedPost(client.getQueriesData({ queryKey: ['feed'] }), postId),
    [client, postId],
  )
}
