import { useLocalSearchParams } from 'expo-router'
import { ProfileScreen } from '../../../src/screens/ProfileScreen'

/**
 * Somebody's profile, pushed over whatever opened it.
 *
 * The screen is `src/screens/ProfileScreen`, because Discover draws it beside
 * its own list on a wide window and a route file cannot be rendered in a
 * panel.
 *
 * **No redirect here, unlike `chat/[id]`.** A thread has one parent — the
 * conversation list — so sending every link into that list's panel is right.
 * A profile has five: Discover, Chats, the viewer list, the leaderboard and a
 * chat header. Opening somebody from a thread and landing in Discover would
 * be a worse answer than a full-screen page, so only Discover's own rows fill
 * Discover's own panel.
 */
export default function ProfileRoute() {
  const { handle, from } = useLocalSearchParams<{ handle: string; from?: string }>()
  return <ProfileScreen handle={handle ?? ''} {...(from ? { from } : {})} />
}
