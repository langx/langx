import {
  deleteMessageSchema,
  reactToMessageSchema,
  sendCorrectionSchema,
  sendMediaMessageSchema,
  sendTextMessageSchema,
} from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import { Server as SocketIOServer } from 'socket.io'
import { z, ZodError } from 'zod'
import { ERROR_CODES } from '@langx/shared'
import { ApiError } from '../lib/ApiError'
import { consumeQuota } from '../lib/quota'
import { effectiveTier } from '../modules/profiles/entitlement'
import { getProfile } from '../modules/profiles/profiles'
import { assertConversationAccess } from '../modules/chat/access'
import { toMessageView } from '../modules/chat/messageView'
import { deleteMessage, reactToMessage } from '../modules/chat/mutations'
import {
  markConversationRead,
  markPendingDelivered,
  sendCorrection,
  sendMediaMessage,
  sendTextMessage,
} from '../modules/chat/messages'
import { fanOutMessage, fanOutMessageUpdate } from './fanOut'
import { PresenceThrottle, touchPresence } from '../modules/presence/presence'
import { SocketRateLimiter } from './rateLimit'
import { userRoom, type AppServer, type AppSocket } from './types'

type AckResponse =
  { ok: true; data?: unknown } | { ok: false; error: { code: string; message: string } }
type Ack = ((response: AckResponse) => void) | undefined

function errorPayload(error: unknown): { code: string; message: string } {
  if (error instanceof ApiError) return { code: error.code, message: error.message }
  if (error instanceof ZodError) return { code: 'VALIDATION_FAILED', message: 'Invalid payload' }
  return { code: 'INTERNAL', message: 'Something went wrong' }
}

const readPayloadSchema = z.object({ conversationId: z.string().trim().min(1) })
const typingPayloadSchema = z.object({
  conversationId: z.string().trim().min(1),
  isTyping: z.boolean(),
})

/**
 * The same session cookie `apiFetch` attaches to REST calls (see its doc
 * comment: web has a real cookie jar, native reads it back out of
 * SecureStore) — a browser's WebSocket handshake carries cookies
 * automatically, but React Native has no cookie jar, so native passes the
 * value explicitly via `auth.cookie` in the socket.io-client connection
 * options instead of a header it can't set on this transport.
 */
async function authenticateSocket(app: FastifyInstance, socket: AppSocket): Promise<string> {
  const authCookie = (socket.handshake.auth as { cookie?: string } | undefined)?.cookie
  const cookie = socket.handshake.headers.cookie ?? authCookie
  if (!cookie) throw new Error('UNAUTHENTICATED')

  const session = await app.auth.api.getSession({ headers: new Headers({ cookie }) })
  if (!session) throw new Error('UNAUTHENTICATED')
  // Matches requireVerifiedEmail's REST-side rule — every profile in the
  // system was already gated on this at creation, so this only ever
  // rejects an unverified account that has no profile (and thus nothing to
  // chat about) trying to open a socket anyway.
  if (!session.user.emailVerified) throw new Error('EMAIL_NOT_VERIFIED')
  return session.user.id
}

/**
 * One room per user (`user:<id>`), not one per conversation — a 1-1 chat
 * only ever has two participants, both already known from the conversation
 * document, so there's nothing a per-conversation room buys here and no
 * separate "join this conversation" handshake for clients to get wrong.
 *
 * Every handler re-derives access through `assertConversationAccess` /
 * the `modules/chat` functions that call it — the same gate REST uses, so
 * the socket transport can't become a back door around it.
 */
export function attachSocketServer(app: FastifyInstance): AppServer {
  const io: AppServer = new SocketIOServer(app.server, {
    cors: {
      origin: app.env.TRUSTED_ORIGINS.length > 0 ? app.env.TRUSTED_ORIGINS : true,
      credentials: true,
    },
  })

  io.use((socket, next) => {
    authenticateSocket(app, socket).then(
      (userId) => {
        socket.data.userId = userId
        next()
      },
      (error: unknown) => next(error instanceof Error ? error : new Error('UNAUTHENTICATED')),
    )
  })

  io.on('connection', (socket) => {
    const userId = socket.data.userId
    socket.data.limiter = new SocketRateLimiter()
    socket.data.presence = new PresenceThrottle()
    void socket.join(userRoom(userId))

    /**
     * Opening the app makes you online, immediately and unthrottled. People
     * expect the dot the moment they arrive, and this is once per connection.
     * Fire-and-forget for the same reason as the delivery sweep below: a
     * missed presence write decays away by itself, a rejection here would
     * take down a working connection.
     */
    void touchPresence(app.mongo.db, userId, new Date()).catch((error: unknown) =>
      app.log.warn({ err: error }, 'presence write on connect failed'),
    )

    /**
     * Connecting *is* the delivery receipt for everything sent while this user
     * was away — this is the only thing that moves those messages off one
     * tick, since the send-time path had no socket to hand them to.
     *
     * Deliberately not awaited and deliberately silent on failure: a second
     * tick appearing late is a cosmetic loss, whereas a rejection here would
     * take down a connection that is otherwise perfectly good.
     */
    void markPendingDelivered(app.mongo.db, userId)
      .then((swept) => {
        for (const { conversationId, senderId, deliveredAt } of swept) {
          io.to(userRoom(senderId)).emit('conversation:delivered', {
            conversationId,
            deliveredTo: userId,
            deliveredAt: deliveredAt.toISOString(),
          })
        }
      })
      .catch((error: unknown) => app.log.warn({ err: error }, 'delivery sweep on connect failed'))

    /**
     * Wraps a handler in the connection's rate limit. Refusing through the ack
     * rather than dropping the frame matters: a client that gets no answer
     * retries, which is the opposite of what a limit is for.
     */
    const limited = (event: string, ack: Ack): boolean => {
      if (socket.data.limiter.take(event)) return true
      ack?.({
        ok: false,
        error: {
          code: ERROR_CODES.RATE_LIMITED,
          message: `Too many ${event} events. Try again in ${socket.data.limiter.retryAfterSeconds(event)}s.`,
        },
      })
      return false
    }

    socket.on('message:send', (payload: unknown, ack: Ack) => {
      if (!limited('message:send', ack)) return
      sendTextMessageSchema
        .parseAsync(payload)
        .then((input) => sendTextMessage(app.mongo.db, userId, input))
        .then(({ message, conversation }) => {
          void fanOutMessage(app, io, conversation, message, { pushWhenAway: true })
          ack?.({ ok: true, data: message })
        })
        .catch((error: unknown) => ack?.({ ok: false, error: errorPayload(error) }))
    })

    // Separate from `message:send` because the payload is a different shape
    // and the quota bucket is different — an attachment costs storage, text
    // does not.
    socket.on('message:media', (payload: unknown, ack: Ack) => {
      if (!limited('message:media', ack)) return
      sendMediaMessageSchema
        .parseAsync(payload)
        .then(async (input) => {
          const profile = await getProfile(app.mongo.db, userId)
          if (!profile) throw new ApiError(ERROR_CODES.NOT_FOUND, 'Complete onboarding first')

          const quota = await consumeQuota(app.mongo.db, userId, effectiveTier(profile), 'media')
          if (!quota.consumed) {
            throw new ApiError(
              ERROR_CODES.QUOTA_EXCEEDED,
              'Daily attachment limit reached',
              quota.nextAvailableAt ? { retryAt: quota.nextAvailableAt.toISOString() } : undefined,
            )
          }
          return sendMediaMessage(app.mongo.db, userId, input, app.env.STORAGE_PUBLIC_BASE_URL)
        })
        .then(({ message, conversation }) => {
          void fanOutMessage(app, io, conversation, message, { pushWhenAway: true })
          ack?.({ ok: true, data: message })
        })
        .catch((error: unknown) => ack?.({ ok: false, error: errorPayload(error) }))
    })

    socket.on('message:correct', (payload: unknown, ack: Ack) => {
      if (!limited('message:correct', ack)) return
      sendCorrectionSchema
        .parseAsync(payload)
        .then((input) => sendCorrection(app.mongo.db, userId, input))
        .then(({ message, conversation }) => {
          // Ticks, but no push: a correction is help arriving in a thread the
          // recipient chose to be in, not something to wake a phone for.
          void fanOutMessage(app, io, conversation, message, { pushWhenAway: false })
          ack?.({ ok: true, data: message })
        })
        .catch((error: unknown) => ack?.({ ok: false, error: errorPayload(error) }))
    })

    /**
     * Both of these go through `loadMutableMessage`, which is where the
     * conversation guard lives — the handler itself checks nothing, and that
     * is the point: a third mutation added later cannot forget to.
     */
    socket.on('message:react', (payload: unknown, ack: Ack) => {
      if (!limited('message:react', ack)) return
      reactToMessageSchema
        .parseAsync(payload)
        .then((input) => reactToMessage(app.mongo.db, userId, input))
        .then(({ message, conversation, audience }) => {
          fanOutMessageUpdate(io, conversation, message, audience, userId)
          ack?.({ ok: true, data: toMessageView(message, userId) })
        })
        .catch((error: unknown) => ack?.({ ok: false, error: errorPayload(error) }))
    })

    socket.on('message:delete', (payload: unknown, ack: Ack) => {
      if (!limited('message:delete', ack)) return
      deleteMessageSchema
        .parseAsync(payload)
        .then((input) => deleteMessage(app.mongo.db, userId, input, app.storage))
        .then(({ message, conversation, audience }) => {
          fanOutMessageUpdate(io, conversation, message, audience, userId)
          ack?.({ ok: true, data: toMessageView(message, userId) })
        })
        .catch((error: unknown) => ack?.({ ok: false, error: errorPayload(error) }))
    })

    socket.on('conversation:read', (payload: unknown, ack: Ack) => {
      if (!limited('conversation:read', ack)) return
      readPayloadSchema
        .parseAsync(payload)
        .then(({ conversationId }) =>
          markConversationRead(app.mongo.db, userId, conversationId).then((conversation) => {
            const otherId = conversation.participants.find((id) => id !== userId)
            if (otherId) {
              io.to(userRoom(otherId)).emit('conversation:read', {
                conversationId,
                readBy: userId,
                readAt: new Date().toISOString(),
              })
            }
            ack?.({ ok: true })
          }),
        )
        .catch((error: unknown) => ack?.({ ok: false, error: errorPayload(error) }))
    })

    // Ephemeral, best-effort — a bad or late payload is silently dropped
    // rather than surfaced, there's no ack channel for typing.
    socket.on('typing', (payload: unknown) => {
      // No ack channel on typing, so an over-limit event is simply dropped.
      if (!socket.data.limiter.take('typing')) return
      typingPayloadSchema
        .parseAsync(payload)
        .then(({ conversationId, isTyping }) =>
          assertConversationAccess(app.mongo.db, conversationId, userId).then((conversation) => {
            const otherId = conversation.participants.find((id) => id !== userId)
            if (otherId)
              io.to(userRoom(otherId)).emit('typing', { conversationId, userId, isTyping })
          }),
        )
        .catch(() => undefined)
    })

    socket.on('presence:ping', (_payload: unknown, ack: Ack) => {
      if (!limited('presence:ping', ack)) return
      // Throttled: a heartbeat is cheap to send and not cheap to store, and
      // without a floor every connected tab is a write per interval.
      if (socket.data.presence.shouldWrite()) {
        void touchPresence(app.mongo.db, userId, new Date()).catch((error: unknown) =>
          app.log.warn({ err: error }, 'presence heartbeat write failed'),
        )
      }
      ack?.({ ok: true })
    })

    /**
     * Leaving stamps `now`, not an offline flag and not a backdated time.
     *
     * It is true ("last seen just now"), it starts the five-minute decay from
     * the moment they actually left rather than from their last message, and
     * it leaves the `active` sort ordered by something real. The reason that
     * matters most is failure: a decaying timestamp cannot get stuck, while a
     * boolean left `true` by a crashed process marks everyone online forever.
     */
    socket.on('disconnect', () => {
      void touchPresence(app.mongo.db, userId, new Date()).catch((error: unknown) =>
        app.log.warn({ err: error }, 'presence write on disconnect failed'),
      )
    })
  })

  return io
}
