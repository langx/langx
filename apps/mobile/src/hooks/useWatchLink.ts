import { useEffect, useMemo } from 'react'
import { useConversations, useMe } from '../api/queries'
import { authClient } from '../lib/auth-client'
import { API_URL } from '../lib/apiUrl'
import { buildWatchPayload } from '../lib/watchPayload'
import { useProfileCache } from './useProfileCache'
import {
  clearWatch,
  sendWatchPayload,
  setWatchCredentials,
  watchIsSupported,
} from '../../modules/watch-link'

/**
 * Keeps the Apple Watch fed, and keeps Swift able to answer for it.
 *
 * Mounted once in the signed-in layout beside `useCompanionSnapshot`, for the
 * reason that hook gives: a wrist has to be right for everybody, not only for
 * people who happen to open the chats tab.
 *
 * It asks for nothing new. The conversation list is already loaded for the
 * tab badge and the chat screen, and the partner names come from the same
 * five-minute profile cache the list itself uses — so on a phone with no
 * watch this hook costs one boolean, and on a phone with one it costs a walk
 * over a list that was already in memory.
 */
export function useWatchLink({ enabled }: { enabled: boolean }): void {
  /*
   * Asked once and never again. `WCSession.isSupported()` is false on an
   * iPad, on web, on a build made before the module existed, and on every
   * iPhone whose owner has no Apple Watch — which is most of them. Everything
   * below is skipped for them, including the profile requests the payload
   * would otherwise warm.
   */
  const supported = useMemo(() => watchIsSupported(), [])
  const active = enabled && supported

  const me = useMe(active)
  const conversations = useConversations('all')

  const unreadThreads = useMemo(() => {
    if (!active) return []
    return (conversations.data?.pages ?? [])
      .flatMap((page) => page.items)
      .filter((conversation) => conversation.unread > 0)
  }, [active, conversations.data])

  const partnerIds = useMemo(
    () =>
      unreadThreads
        .map((conversation) => conversation.participants.find((p) => p !== me.data?._id))
        .filter((id): id is string => typeof id === 'string'),
    [unreadThreads, me.data?._id],
  )
  const partners = useProfileCache(partnerIds)

  const names = useMemo(() => {
    const map: Record<string, string | undefined> = {}
    for (const id of partnerIds) map[id] = partners[id]?.displayName
    return map
  }, [partnerIds, partners])

  const meId = me.data?._id

  /*
   * The cookie, handed to Swift so a reply can be sent with no JavaScript
   * running. Separate from the payload effect because it changes on a
   * completely different clock — a session refresh, not an arriving message —
   * and because getting it is asynchronous while sending a payload is not.
   */
  useEffect(() => {
    if (!supported) return
    if (!enabled) {
      clearWatch()
      return
    }
    let cancelled = false
    void authClient.getCookie().then((cookie) => {
      if (!cancelled && cookie) setWatchCredentials(API_URL, cookie)
    })
    return () => {
      cancelled = true
    }
  }, [enabled, supported])

  useEffect(() => {
    if (!active || meId === undefined) return

    sendWatchPayload(buildWatchPayload({ meId, conversations: unreadThreads, names }))
  }, [active, meId, unreadThreads, names])
}
