import { sendCorrectionSchema, sendMediaMessageSchema, sendTextMessageSchema } from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import type { ObjectId } from 'mongodb'
import { Server as SocketIOServer, type Socket } from 'socket.io'
import { z, ZodError } from 'zod'
import { ERROR_CODES } from '@langx/shared'
import { ApiError } from '../lib/ApiError'
import { consumeQuota } from '../lib/quota'
import { effectiveTier } from '../modules/profiles/entitlement'
import { getProfile } from '../modules/profiles/profiles'
import { assertConversationAccess } from '../modules/chat/access'
import {
  markConversationRead,
  markDelivered,
  markPendingDelivered,
  sendCorrection,
  sendMediaMessage,
  sendTextMessage,
} from '../modules/chat/messages'
import { sendPush, tokensFor } from '../modules/push/devices'
import { SocketRateLimiter } from './rateLimit'

function userRoom(userId: string): string {
  return `user:${userId}`
}

/**
 * The two things that happen to a message the instant after it is written, and
 * the reason they are one function: both hinge on the same question — is the
 * recipient holding a socket right now?
 *
 * If they are, `message:new` above just reached their device, which is the
 * second tick; we stamp `deliveredAt` and tell the sender. If they are not,
 * their phone buzzes instead, and the message stays on one tick until they
 * connect and {@link markPendingDelivered} sweeps it up. Someone with the
 * thread open on screen does not need a notification about the message they
 * are watching arrive, and someone who is away has nothing to deliver to — the
 * two branches are genuinely exclusive, so asking twice would only create room
 * for the answer to change in between.
 *
 * Best-effort by design: a failed push or a failed stamp must never fail the
 * send. The message is durably written by the time this runs.
 *
 * `pushWhenAway` is false for corrections, which have never notified.
 */
async function deliverToRecipient(
  app: FastifyInstance,
  io: AppServer,
  conversation: { _id: ObjectId; participants: readonly string[] },
  message: { senderId: string; body: string; conversationId: { toHexString: () => string } },
  { pushWhenAway }: { pushWhenAway: boolean },
): Promise<void> {
  try {
    const recipientId = conversation.participants.find((id) => id !== message.senderId)
    if (!recipientId) return
    const sockets = await io.in(userRoom(recipientId)).fetchSockets()
    if (sockets.length > 0) {
      const deliveredAt = await markDelivered(app.mongo.db, conversation._id, recipientId)
      if (deliveredAt) {
        io.to(userRoom(message.senderId)).emit('conversation:delivered', {
          conversationId: message.conversationId.toHexString(),
          deliveredTo: recipientId,
          deliveredAt: deliveredAt.toISOString(),
        })
      }
      return
    }
    if (!pushWhenAway) return

    const [sender, tokens] = await Promise.all([
      app.mongo.db
        .collection<{ displayName?: string; handle: string }>('profiles')
        .findOne({ _id: message.senderId as unknown as never }),
      tokensFor(app.mongo.db, recipientId),
    ])
    if (tokens.length === 0) return

    await sendPush(app.mongo.db, app.push, {
      to: tokens,
      title: sender?.displayName ?? sender?.handle ?? 'LangX',
      body: message.body.slice(0, 120),
      data: { kind: 'message', conversationId: message.conversationId.toHexString() },
    })
  } catch (error) {
    app.log.warn({ err: error }, 'post-send delivery fan-out failed')
  }
}

interface SocketData {
  userId: string
  /** Per-connection token buckets; see ws/rateLimit.ts. */
  limiter: SocketRateLimiter
}

/** Socket.io's four generics default `data` to `any` — this pins it down so `.data.userId` typechecks. */
type AppSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  SocketData
>
type AppServer = SocketIOServer<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  SocketData
>

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
    void socket.join(userRoom(userId))

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
          for (const participantId of conversation.participants) {
            io.to(userRoom(participantId)).emit('message:new', message)
          }
          void deliverToRecipient(app, io, conversation, message, { pushWhenAway: true })
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
          for (const participantId of conversation.participants) {
            io.to(userRoom(participantId)).emit('message:new', message)
          }
          void deliverToRecipient(app, io, conversation, message, { pushWhenAway: true })
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
          for (const participantId of conversation.participants) {
            io.to(userRoom(participantId)).emit('message:new', message)
          }
          // Ticks, but no push: a correction is help arriving in a thread the
          // recipient chose to be in, not something to wake a phone for.
          void deliverToRecipient(app, io, conversation, message, { pushWhenAway: false })
          ack?.({ ok: true, data: message })
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
  })

  return io
}
