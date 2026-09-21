import { useLocalSearchParams } from 'expo-router'
import { PostScreen } from '../../../src/screens/PostScreen'

/**
 * A post and its corrections, pushed over whatever opened it.
 *
 * The screen is `src/screens/PostScreen`, because the feed draws it beside
 * its own list on a wide window and a route file cannot be rendered in a
 * panel.
 *
 * No redirect, for the reason `profile/[handle]` gives: a post has three
 * parents — the feed, the corrections list and a correction's own page — so
 * only the feed's own rows fill the feed's own panel.
 */
export default function PostRoute() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>()
  return <PostScreen postId={id ?? ''} {...(from ? { from } : {})} />
}
