import { Platform } from 'react-native'
import { useEffect, useMemo } from 'react'
import { useConversations, useMe } from '../api/queries'
import { buildCompanionDirectory } from '../lib/companionDirectory'
import { useProfileCache } from './useProfileCache'
import { useT } from '../i18n'
import { writeCompanionDirectory } from '../../modules/companion-snapshot'

/**
 * Keeps the App Intents able to name a conversation.
 *
 * Mounted once in the signed-in layout beside `useCompanionSnapshot` and
 * `useWatchLink`, and it asks for nothing any of them has not already asked
 * for: the conversation list is loaded for the tab badge and the chat list,
 * and the names come from the same five-minute profile cache those screens
 * fill. On a phone that never opens Shortcuts this costs one `useMemo` over a
 * list that was already in memory.
 *
 * **iOS only, and it exits before the queries.** Nothing on Android reads a
 * directory — the Wear app has its own payload and the widgets draw numbers —
 * so `enabled` is false there and `useMe` is never switched on. The write
 * itself is a no-op off iOS anyway; this is about not warming a request for
 * an answer nobody wants.
 *
 * **CarPlay is the second reader**, and the reason each entry now carries an
 * unread count, a phrase for it, a time and a preview. It costs one more
 * `t()` per unread conversation and nothing else: the list, the names and the
 * previews were all already here.
 *
 * Emptied at sign-out by the root's account-switch effect, with the snapshot
 * and the two watches. This is a cache of what is already on screen, not
 * state: it is written whenever the list changes and nothing depends on the
 * previous value.
 */
export function useCompanionDirectory({ enabled }: { enabled: boolean }): void {
  const active = enabled && Platform.OS === 'ios'
  const t = useT()

  const me = useMe(active)
  const conversations = useConversations('all')
  const meId = me.data?._id

  const items = useMemo(() => {
    if (!active) return []
    return (conversations.data?.pages ?? []).flatMap((page) => page.items)
  }, [active, conversations.data])

  const partnerIds = useMemo(
    () =>
      items
        .map((conversation) => conversation.participants.find((p) => p !== meId))
        .filter((id): id is string => typeof id === 'string'),
    [items, meId],
  )
  const partners = useProfileCache(partnerIds)

  const names = useMemo(() => {
    const map: Record<string, string | undefined> = {}
    for (const id of partnerIds) map[id] = partners[id]?.displayName
    return map
  }, [partnerIds, partners])

  useEffect(() => {
    if (!active || meId === undefined) return
    writeCompanionDirectory(
      buildCompanionDirectory({
        meId,
        conversations: items,
        names,
        unreadLabel: (count) => t('chats.unreadNew', { count }),
      }),
    )
  }, [active, meId, items, names, t])
}
