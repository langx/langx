import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { MessageDto } from '../api/queries'
import { keys } from '../api/queries'
import { closeSocket, getSocket } from '../lib/socket'

/**
 * Opens the app's single socket and turns realtime events into cache updates.
 *
 * The screens themselves never subscribe: a message arriving is a *data*
 * change, and the chat screen, the conversation list and its unread badge all
 * read that data through TanStack Query. Pushing it into the cache updates
 * every one of them, including the ones not currently mounted.
 */
export function useSocket(): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    let cancelled = false

    void (async () => {
      const socket = await getSocket()
      if (cancelled) return

      socket.on('message:new', (message: MessageDto) => {
        const conversationId =
          typeof message.conversationId === 'string'
            ? message.conversationId
            : String(message.conversationId)

        queryClient.setQueryData<{ items: MessageDto[]; nextCursor: string | null }>(
          keys.messages(conversationId),
          (old) => {
            if (!old) return old
            // The sender already appended this optimistically; the socket
            // echoes to *both* participants, so guard against a duplicate.
            if (old.items.some((m) => String(m._id) === String(message._id))) return old
            return { ...old, items: [...old.items, message] }
          },
        )
        void queryClient.invalidateQueries({ queryKey: keys.conversations })
        void queryClient.invalidateQueries({ queryKey: keys.tokens })
      })

      /**
       * Patched into the cache rather than invalidated, unlike the read event
       * below. Delivery fires on *every* message sent to someone who is
       * online, so refetching the thread each time would put a request behind
       * every keystroke-turned-message in an active conversation — and the
       * event already carries everything the change needs. Reads are the
       * rarer event and clear an unread count the client cannot recompute,
       * which is why that one still goes back to the server.
       */
      socket.on(
        'conversation:delivered',
        ({
          conversationId,
          deliveredTo,
          deliveredAt,
        }: {
          conversationId: string
          deliveredTo: string
          deliveredAt: string
        }) => {
          queryClient.setQueryData<{ items: MessageDto[]; nextCursor: string | null }>(
            keys.messages(conversationId),
            (old) => {
              if (!old) return old
              // The server stamped every message in the thread the recipient
              // had not received yet, so this mirrors that filter exactly:
              // theirs are not mine to mark, and an existing timestamp is the
              // moment it actually arrived.
              let changed = false
              const items = old.items.map((message) => {
                if (message.senderId === deliveredTo || message.deliveredAt) return message
                changed = true
                return { ...message, deliveredAt }
              })
              return changed ? { ...old, items } : old
            },
          )
        },
      )

      socket.on('conversation:read', ({ conversationId }: { conversationId: string }) => {
        void queryClient.invalidateQueries({ queryKey: keys.messages(conversationId) })
        // The chat list too: reading a conversation clears its unread count,
        // and without this the badge stays up until something else happens to
        // refetch — including when *you* are the one who read it elsewhere.
        void queryClient.invalidateQueries({ queryKey: keys.conversations })
      })
    })()

    return () => {
      cancelled = true
      closeSocket()
    }
  }, [queryClient])
}
