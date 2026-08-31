import { PRESENCE_HEARTBEAT_MS } from '@langx/shared'
import type { InfiniteData } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { MessageDto } from '../api/queries'
import { keys } from '../api/queries'
import { applyIncomingMessage, type ConversationPageDto } from '../lib/conversationCache'
import {
  appendIncomingMessage,
  applyDeliveredAt,
  applyMessageUpdate,
  applyPinned,
  type MessagePageDto,
} from '../lib/messageCache'
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
    let heartbeat: ReturnType<typeof setInterval> | null = null

    void (async () => {
      const socket = await getSocket()
      if (cancelled) return

      /**
       * Says "still here" while the app is open. Without it `lastActiveAt`
       * only moved when a message was sent, so browsing for an hour left you
       * offline. Lives with the socket rather than in a screen for the reason
       * `_layout.tsx` gives for owning the socket once.
       */
      heartbeat = setInterval(() => {
        socket.emit('presence:ping', {})
      }, PRESENCE_HEARTBEAT_MS)

      socket.on('message:new', (message: MessageDto) => {
        const conversationId =
          typeof message.conversationId === 'string'
            ? message.conversationId
            : String(message.conversationId)

        /**
         * `setQueriesData` with the *prefix*, not `setQueryData` with the key:
         * `keys.messagesAround` lives under `keys.messages(id)`, so a jump
         * window open on this thread is patched by the same call. Without it
         * the window silently stops receiving anything while it is on screen.
         * `appendIncomingMessage` decides for itself whether a given cache is
         * one a new message belongs in.
         */
        queryClient.setQueriesData<InfiniteData<MessagePageDto>>(
          { queryKey: keys.messages(conversationId) },
          (old) => appendIncomingMessage(old, message) ?? old,
        )

        /**
         * Patched rather than invalidated. On an infinite query
         * `invalidateQueries` refetches *every loaded page*, sequentially —
         * one request while the chat list had one page, ten once someone has
         * scrolled, on every single incoming message. The fall back to
         * invalidating is for a conversation that has scrolled out of the
         * loaded pages, which is the one case this cannot patch.
         */
        const meId = queryClient.getQueryData<{ _id: string }>(keys.me)?._id
        let patched = false
        /*
         * `setQueriesData` on the prefix, not `setQueryData` on one key. The
         * list is tabbed now, so several caches hold the same thread — patching
         * only the visible one is how the tabs start disagreeing about who
         * spoke last.
         */
        queryClient.setQueriesData<InfiniteData<ConversationPageDto>>(
          { queryKey: ['conversations'] },
          (old) => {
            if (!old || !meId) return old
            const next = applyIncomingMessage(old, {
              conversationId,
              body: message.body,
              senderId: message.senderId,
              createdAt: message.createdAt,
              forUserId: meId,
            })
            if (!next) return old
            patched = true
            return next
          },
        )
        if (!patched) void queryClient.invalidateQueries({ queryKey: ['conversations'] })
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
      /**
       * One event for every mutation, carrying the message's whole new state.
       * A client that applies "the message is now this" cannot drift; one that
       * applied a patch would have to be right about the order they arrive in.
       */
      socket.on('message:updated', (message: MessageDto) => {
        const conversationId = String(message.conversationId)
        queryClient.setQueriesData<InfiniteData<MessagePageDto>>(
          { queryKey: keys.messages(conversationId) },
          (old) => applyMessageUpdate(old, message) ?? old,
        )
        // A withdrawal empties the chat list's preview too, and that is the
        // one thing this cannot patch from here.
        if (message.deleted) {
          void queryClient.invalidateQueries({ queryKey: ['conversations'] })
        }
      })

      socket.on(
        'conversation:pinned',
        ({
          conversationId,
          pinned,
        }: {
          conversationId: string
          pinned: MessagePageDto['pinned']
        }) => {
          queryClient.setQueriesData<InfiniteData<MessagePageDto>>(
            { queryKey: keys.messages(conversationId) },
            (old) => applyPinned(old, pinned) ?? old,
          )
        },
      )

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
          queryClient.setQueriesData<InfiniteData<MessagePageDto>>(
            { queryKey: keys.messages(conversationId) },
            (old) => applyDeliveredAt(old, { deliveredTo, deliveredAt }) ?? old,
          )
        },
      )

      /**
       * Still invalidated, unlike `message:new` above. This fires once when
       * someone opens a thread, not once per message, so refetching the
       * loaded pages is cheap here — and the event is delivered only to the
       * *other* participant, carrying `readBy`, which is not the unread count
       * this client draws. Patching it would change nothing visible.
       */
      socket.on('conversation:read', ({ conversationId }: { conversationId: string }) => {
        void queryClient.invalidateQueries({ queryKey: keys.messages(conversationId) })
        void queryClient.invalidateQueries({ queryKey: ['conversations'] })
      })
    })()

    return () => {
      cancelled = true
      if (heartbeat) clearInterval(heartbeat)
      closeSocket()
    }
  }, [queryClient])
}
