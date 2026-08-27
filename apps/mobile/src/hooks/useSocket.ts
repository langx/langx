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
        void queryClient.invalidateQueries({ queryKey: keys.xp })
      })

      socket.on('conversation:read', ({ conversationId }: { conversationId: string }) => {
        void queryClient.invalidateQueries({ queryKey: keys.messages(conversationId) })
      })
    })()

    return () => {
      cancelled = true
      closeSocket()
    }
  }, [queryClient])
}
