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
import {
  clearWear,
  sendWearPayload,
  setWearCredentials,
  wearIsSupported,
} from '../../modules/wear-link'

/**
 * Keeps a paired watch fed, and keeps native able to answer for it.
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
 *
 * **Both watches, one payload.** The Apple Watch and the Wear OS app read the
 * same `watchPayloadSchema` blob and differ only in how it travels —
 * `WCSession` on one side, the Data Layer on the other. Each module is a
 * no-op on the platform it does not belong to, so nothing here branches on
 * `Platform.OS`; asking both is how the two stay the same feature rather than
 * two features that resemble each other.
 */
export function useWatchLink({ enabled }: { enabled: boolean }): void {
  /*
   * Asked once and never again. `WCSession.isSupported()` is false on an
   * iPad, on web, on a build made before the module existed, and on every
   * iPhone whose owner has no Apple Watch — which is most of them. Everything
   * below is skipped for them, including the profile requests the payload
   * would otherwise warm.
   */
  const supported = useMemo(() => watchIsSupported() || wearIsSupported(), [])
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
      clearWear()
      return
    }
    let cancelled = false
    void authClient.getCookie().then((cookie) => {
      if (cancelled || !cookie) return
      setWatchCredentials(API_URL, cookie)
      setWearCredentials(API_URL, cookie)
    })
    return () => {
      cancelled = true
    }
  }, [enabled, supported])

  useEffect(() => {
    if (!active || meId === undefined) return

    const payload = buildWatchPayload({
      meId,
      conversations: unreadThreads,
      names,
      // Already loaded for the tab badge and the widgets; the complication is
      // the third reader of it and causes no request of its own.
      ...(me.data?.streak?.current === undefined ? {} : { streak: me.data.streak.current }),
    })
    sendWatchPayload(payload)
    sendWearPayload(payload)
  }, [active, meId, unreadThreads, names, me.data?.streak?.current])
}
