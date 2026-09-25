import {
  conversationFlagsSchema,
  ERROR_CODES,
  listConversationMediaQuerySchema,
  listConversationsQuerySchema,
  listMessagesQuerySchema,
  listStarredQuerySchema,
  listCorrectionsQuerySchema,
  sendTextMessageSchema,
} from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { ApiError } from '../lib/ApiError'
import { requireAuth, requireMember, requireVerifiedEmail } from '../middleware/requireAuth'
import {
  countUnread,
  listConversations,
  listMessages,
  listMessagesAround,
  markConversationRead,
  sendTextMessage,
  upcomingMeetingsFor,
} from '../modules/chat/messages'
import { assertConversationAccess } from '../modules/chat/access'
import { listConversationMedia } from '../modules/chat/conversationMedia'
import { toConversationView } from '../modules/chat/conversationView'
import { toMessageView } from '../modules/chat/messageView'
import { listCorrectionsWritten } from '../modules/chat/corrections'
import {
  deleteConversationForUser,
  listStarredMessages,
  setConversationFlag,
} from '../modules/chat/mutations'
import { speakMessage } from '../modules/chat/speak'
import { fanOutMessage } from '../ws/fanOut'
import { sendTraySync } from '../ws/traySync'

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const messageRoutes: FastifyPluginAsyncZod = async (app) => {
  /*
   * One route for both flags rather than four verbs. Pin and archive are the
   * same operation — a per-user boolean on a thread — and splitting them into
   * `POST`/`DELETE` pairs would be four handlers doing one thing.
   */
  app.patch(
    '/conversations/:id/flags',
    {
      preHandler: requireAuth,
      schema: {
        params: z.object({ id: z.string().trim().min(1) }),
        body: conversationFlagsSchema,
      },
    },
    async (request, reply) => {
      const { pinned, archived } = request.body
      let view = null
      if (pinned !== undefined) {
        view = await setConversationFlag(
          app.mongo.db,
          request.params.id,
          request.userId,
          'pinnedBy',
          pinned,
        )
      }
      if (archived !== undefined) {
        view = await setConversationFlag(
          app.mongo.db,
          request.params.id,
          request.userId,
          'archivedBy',
          archived,
        )
      }
      if (!view) throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'Nothing to change')
      return reply.send(view)
    },
  )

  /*
   * Its own route rather than a third flag: pinning and archiving are two
   * states of a row that can be set either way, and this is neither. Nothing
   * comes back — the thread is gone from every list, so there is no view left
   * to return.
   */
  app.delete(
    '/conversations/:id',
    {
      preHandler: requireAuth,
      schema: { params: z.object({ id: z.string().trim().min(1) }) },
    },
    async (request, reply) => {
      await deleteConversationForUser(app.mongo.db, request.params.id, request.userId)
      return reply.code(204).send()
    },
  )

  /*
   * One thread as the list would draw it — the viewer's own pin and archive
   * state above all. The thread screen needs it for the header's menu and
   * used to have no way to ask short of paging the whole list; the message
   * window carries `participants` and the media lock but not the flags.
   * `assertConversationAccess` is the same gate the messages take: a stranger
   * gets the 404 that says nothing.
   */
  app.get(
    '/conversations/:id',
    {
      preHandler: requireAuth,
      schema: { params: z.object({ id: z.string().trim().min(1) }) },
    },
    async (request, reply) => {
      const conversation = await assertConversationAccess(
        app.mongo.db,
        request.params.id,
        request.userId,
      )
      return reply.send(toConversationView(conversation, request.userId))
    },
  )

  app.get(
    '/conversations',
    { preHandler: requireAuth, schema: { querystring: listConversationsQuerySchema } },
    async (request, reply) => {
      const page = await listConversations(app.mongo.db, request.userId, request.query)
      return reply.send(page)
    },
  )

  /*
   * One number for the tab badge. Its own route rather than a field on the
   * conversations page: the badge has to be right on a screen that never
   * opened the chats list, and the list is paged besides.
   */
  /**
   * The calls this person has agreed to and has not had yet.
   *
   * `requireAuth` rather than `requireVerifiedEmail`: this reads nothing an
   * unverified account could not already see in its own threads, and the
   * Live Activity that asks for it runs on a phone that is already signed in.
   */
  app.get('/me/meetings/upcoming', { preHandler: requireAuth }, async (request, reply) => {
    const meetings = await upcomingMeetingsFor(app.mongo.db, request.userId)
    return reply.send({ items: meetings })
  })

  app.get('/me/unread', { preHandler: requireAuth }, async (request, reply) => {
    const total = await countUnread(app.mongo.db, request.userId)
    return reply.send({ total })
  })

  /*
   * The message, read aloud by the voice service.
   *
   * No body: which language it is in is decided on this side, from the text we
   * already hold. The app runs the same detection to decide whether to offer
   * the row, but a `lang` arriving from outside would let a client pick the
   * cache key — and so write a permanent object under a language nobody in the
   * thread speaks.
   *
   * `requireMember` rather than `requireVerifiedEmail`, matching
   * `/echo/cards/:id/voices`: this wakes a machine of ours, which guests may
   * not do, but it reaches nobody. The tight route limit is there for the same
   * reason as Echo's; the daily ceiling is `chatVoices`.
   */
  app.post(
    '/conversations/:id/messages/:messageId/speak',
    {
      preHandler: requireMember,
      schema: {
        params: z.object({
          id: z.string().trim().min(1),
          messageId: z.string().trim().min(1),
        }),
      },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const reading = await speakMessage(
        app.mongo.db,
        app.storage,
        app.tts,
        request.userId,
        request.params.id,
        request.params.messageId,
      )
      return reply.send(reading)
    },
  )

  app.get(
    '/conversations/:id/messages',
    {
      preHandler: requireAuth,
      schema: { querystring: listMessagesQuerySchema },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { around, ...rest } = request.query
      // Same path, same guard, same response shape — `around` only changes
      // which way the cursor is anchored, so it does not earn a second route.
      if (around !== undefined) {
        if (rest.cursor !== undefined || rest.after !== undefined) {
          throw new ApiError(
            ERROR_CODES.VALIDATION_FAILED,
            'Pass around on its own, without cursor or after',
          )
        }
        const window = await listMessagesAround(app.mongo.db, request.userId, id, {
          around,
          limit: rest.limit,
        })
        return reply.send(window)
      }
      const page = await listMessages(app.mongo.db, request.userId, id, rest)
      return reply.send(page)
    },
  )

  /**
   * Everything this thread has attached, as its own screen.
   *
   * Its own route rather than a filter on the message window above: the grid
   * pages over attachments alone, and asking the thread for them would mean
   * walking every text message in between to find them — which is what the
   * `conversation_type_created` index exists to avoid.
   *
   * Both halves of the request are declared, unlike the route above — as
   * `feed.ts` and `follows.ts` do on every parameterised list. Without
   * `params` in the schema `request.params` needs the cast that route still
   * carries, and a cast is the thing that stops being checked the day the id
   * gains a shape.
   */
  app.get(
    '/conversations/:id/media',
    {
      preHandler: requireAuth,
      schema: {
        params: z.object({ id: z.string().trim().min(1) }),
        querystring: listConversationMediaQuerySchema,
      },
    },
    async (request, reply) => {
      const page = await listConversationMedia(
        app.mongo.db,
        request.userId,
        request.params.id,
        request.query,
      )
      return reply.send(page)
    },
  )

  /**
   * Starred messages, across every conversation.
   *
   * REST rather than a socket event because it is a screen someone opens, not
   * a stream — and it is the only read in the chat area that is not scoped to
   * one thread, which is why it hangs off `/me` rather than `/conversations`.
   */
  app.get(
    '/me/starred',
    { preHandler: requireAuth, schema: { querystring: listStarredQuerySchema } },
    async (request, reply) => {
      const messages = await listStarredMessages(app.mongo.db, request.userId, request.query.limit)
      return reply.send({ items: messages.map((m) => toMessageView(m, request.userId)) })
    },
  )

  /**
   * The list behind the corrections count on the profile.
   *
   * Hangs off `/me` for the same reason `/me/starred` does — it is a read
   * across every conversation rather than within one — but paged, because a
   * correction history is meant to grow and a capped list would hide the older
   * half of the thing the screen exists to show.
   */
  app.get(
    '/me/corrections',
    { preHandler: requireAuth, schema: { querystring: listCorrectionsQuerySchema } },
    async (request, reply) => {
      const page = await listCorrectionsWritten(
        app.mongo.db,
        request.userId,
        request.query.limit,
        request.query.cursor,
      )
      return reply.send({
        items: page.items.map(({ message, recipientId }) => ({
          ...toMessageView(message, request.userId),
          ...(recipientId ? { recipientId } : {}),
        })),
        nextCursor: page.nextCursor,
      })
    },
  )

  /*
   * Send a text message without a socket.
   *
   * The socket is still how the app sends: it is already open, the ack is the
   * delivery receipt, and typing indicators need it anyway. This exists for
   * the callers that cannot hold one. The first is the Apple Watch — a reply
   * dictated on the wrist reaches an iPhone that may be asleep in a pocket,
   * and WatchConnectivity wakes that app in the *background*, where there is
   * no socket and no JavaScript, only a few seconds of native runtime. The
   * plan called this the "REST send twin" and scheduled it for CarPlay, which
   * needs it for exactly the same reason; the watch got here first.
   *
   * Every guard lives in `sendTextMessage` and every side effect in
   * `fanOutMessage`, so this handler holds neither. That is the point rather
   * than tidiness: a second send path that re-implemented access control,
   * quota or token accounting would be a second set of rules free to drift
   * from the socket's, and the drift would show up as somebody being charged
   * twice or not at all. The two paths differ in transport and in nothing
   * else.
   *
   * Text only, deliberately. `message:media` checks its files and its storage
   * quota in the handler as well as in the module, so a REST twin of *that*
   * would be the drift this comment warns about.
   *
   * `requireVerifiedEmail` matches `authenticateSocket`, which refuses an
   * unverified account rather than letting the socket become the softer door.
   * The rate limit is the REST spelling of the socket's token bucket for
   * `message:send` — 20 with a slow refill — so neither transport is the
   * cheaper way to flood a thread.
   */
  app.post(
    '/conversations/:id/messages',
    {
      preHandler: requireVerifiedEmail,
      schema: {
        params: z.object({ id: z.string().trim().min(1) }),
        body: sendTextMessageSchema.omit({ conversationId: true }),
      },
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { message, conversation } = await sendTextMessage(app.mongo.db, request.userId, {
        ...request.body,
        conversationId: request.params.id,
      })
      await fanOutMessage(app, app.io, conversation, message, { pushWhenAway: true })
      return reply.send(toMessageView(message, request.userId))
    },
  )

  // REST fallback for marking a thread read (e.g. opened from a push
  // notification before a socket connection exists) — still fans the
  // realtime `conversation:read` event out over `app.io`, so the sender's
  // UI updates the same way regardless of which transport the reader used.
  app.post('/conversations/:id/read', { preHandler: requireMember }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { conversation, wasUnread } = await markConversationRead(app.mongo.db, request.userId, id)
    const readAt = new Date().toISOString()
    const otherId = conversation.participants.find((p) => p !== request.userId)
    if (otherId) {
      app.io.to(`user:${otherId}`).emit('conversation:read', {
        conversationId: id,
        readBy: request.userId,
        readAt,
      })
    }
    // And the reader's own other devices, which is not the same thing: the
    // sender learns their message was read, while a second phone learns its
    // unread total just dropped. Without this it keeps a badge for messages
    // that were read on another device until something else invalidates.
    app.io.to(`user:${request.userId}`).emit('conversation:read', {
      conversationId: id,
      readBy: request.userId,
      readAt,
    })
    // And the phones with no socket to hear that on. See `ws/traySync.ts`.
    if (wasUnread) void sendTraySync(app, request.userId)
    return reply.send(conversation)
  })
}
