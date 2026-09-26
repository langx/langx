import { useMemo } from 'react'
import type { ConversationDto, ConversationPartnerDto } from '../api/queries'
import { useProfileCache } from './useProfileCache'

/** What a chat row draws of the person on the other side. */
export type RowPartner = Pick<
  ConversationPartnerDto,
  '_id' | 'displayName' | 'avatarUrl' | 'isOnline' | 'official'
>

/**
 * The partner of each conversation, keyed by their user id.
 *
 * The chat list carries its partners now, so this normally asks for nothing.
 * It used to be `useProfileCache` over every row, which is a `/profiles/:id`
 * per partner: thirteen database reads each on the server and a recorded
 * profile view on everybody you talk to, every time the list was drawn. On a
 * shared Atlas tier twenty threads were enough to stall an app open.
 *
 * The profile cache is still the fallback, for exactly the rows that arrive
 * without a partner — a list cached by an older API, or a partner whose
 * profile the server could not find — so a row can always get its name.
 */
export function useConversationPartners(
  conversations: ConversationDto[],
  meId: string | undefined,
): Record<string, RowPartner | undefined> {
  const missing = useMemo(
    () =>
      conversations
        .filter((conversation) => !conversation.partner)
        .map((conversation) => conversation.participants.find((id) => id !== meId))
        .filter((id): id is string => typeof id === 'string'),
    [conversations, meId],
  )
  const fetched = useProfileCache(missing)

  return useMemo(() => {
    const map: Record<string, RowPartner | undefined> = { ...fetched }
    for (const conversation of conversations) {
      if (conversation.partner) map[conversation.partner._id] = conversation.partner
    }
    return map
  }, [conversations, fetched])
}
