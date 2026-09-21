import { Redirect, useLocalSearchParams } from 'expo-router'
import { ChatScreen } from '../../../src/screens/ChatScreen'
import { useTwoPane } from '../../../src/hooks/useTwoPane'

/**
 * A thread, pushed over the list — which is what a phone does.
 *
 * The screen itself is `src/screens/ChatScreen`, because on a wide enough
 * window it is not pushed at all: it is drawn beside the list, inside the
 * chats tab, and a route file cannot be rendered in a panel. This one reads
 * the route's parameters and hands them over, and nothing else.
 */
export default function ChatRoute() {
  const { id, at, inPlace, ask, draft } = useLocalSearchParams<{
    id: string
    at?: string
    inPlace?: string
    ask?: string
    draft?: string
  }>()
  const twoPane = useTwoPane()

  /*
   * On a wide window the thread belongs in the panel, so the route hands the
   * job over rather than covering the list with it. Every way into a thread
   * comes through here — a notification, a widget, a shared link, the
   * profile's "message" button — so this one redirect is what keeps them all
   * landing in the same place as a tap on the list does.
   *
   * `replace`, through `Redirect`: a pushed screen that immediately hands
   * over would otherwise leave an entry behind for the back gesture to find.
   */
  if (twoPane && id) {
    return (
      <Redirect
        href={{ pathname: '/(app)/(tabs)/chats', params: { open: id, ...(at ? { at } : {}) } }}
      />
    )
  }

  return (
    <ChatScreen
      conversationId={id ?? ''}
      {...(at ? { at } : {})}
      {...(inPlace ? { inPlace } : {})}
      {...(ask ? { ask } : {})}
      {...(draft ? { draft } : {})}
    />
  )
}
