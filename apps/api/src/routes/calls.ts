import {
  CALL_TOKEN_HEADER,
  ERROR_CODES,
  callRefSchema,
  endCallSchema,
  registerCallEndpointSchema,
} from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { ApiError } from '../lib/ApiError'
import { requireVerifiedEmail } from '../middleware/requireAuth'
import { verifyCallToken } from '../modules/calls/callToken'
import { findCall } from '../modules/calls/calls'
import { registerCallEndpoint } from '../modules/calls/endpoints'
import { callStatus, currentCall, endCallByParty } from '../modules/calls/service'

const endBodySchema = endCallSchema.omit({ callId: true })

/**
 * The part of calling that does not happen on a socket.
 *
 * A call is placed, answered and carried over the socket — `ws/calls.ts` — and
 * nothing here can do any of that. These are the things that have to work when
 * there is no socket to do them on: a phone registering that it can be rung,
 * an app that has just come forward asking what it missed, and a call being
 * ended by something that has no socket at all.
 *
 * Verified email on every route but one, which is what the socket's handshake
 * requires: the two transports refuse the same people. The one is the decline
 * a lock screen sends, which has a ticket instead of a session.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const callRoutes: FastifyPluginAsyncZod = async (app) => {
  /** None of it under `NODE_ENV=test` — see the same helper in `feedback.ts`. */
  const limit = (max: number, timeWindow: string) =>
    app.env.NODE_ENV === 'test' ? false : { max, timeWindow }

  /**
   * The call this account is in, or being rung for, right now.
   *
   * `null` is the ordinary answer. Asked on coming to the foreground and on
   * every reconnect, because `call:incoming` is sent once, to whoever was
   * listening, and an app that was asleep at that moment was not.
   */
  app.get('/calls/current', { preHandler: requireVerifiedEmail }, async (request, reply) => {
    return reply.send({ current: await currentCall(app, request.userId) })
  })

  app.get(
    '/calls/:callId',
    { preHandler: requireVerifiedEmail, schema: { params: callRefSchema } },
    async (request, reply) => {
      return reply.send(await callStatus(app, request.userId, request.params.callId))
    },
  )

  /**
   * Ends a call: the caller giving up, the other person declining, or either
   * of them hanging up.
   *
   * The REST twin of `call:end`, and it goes through the same function. It is
   * here for an app whose socket is the thing that broke, hanging up the call
   * that was on it — which is why, once a call is answered, it has to prove it
   * is the device in the call with the key it was handed.
   */
  app.post(
    '/calls/:callId/end',
    {
      preHandler: requireVerifiedEmail,
      schema: { params: callRefSchema, body: endBodySchema },
      config: { rateLimit: limit(30, '1 minute') },
    },
    async (request, reply) => {
      const ended = await endCallByParty(
        app,
        request.userId,
        { callId: request.params.callId, ...request.body },
        // Never in the room: this request did not arrive on a socket.
        { inRoom: false },
      )
      return reply.send(ended)
    },
  )

  /**
   * "Decline", from native code with no session in reach — the button on a
   * lock screen.
   *
   * Its own route rather than a second way into the one above, so that which
   * credential a request is judged by is decided by the path it was sent to
   * and never by what the request chose to carry. This one takes the ticket
   * that arrived in the ring (`callToken.ts`) and nothing else. The ticket is
   * checked against the call's own record of who was being rung: it never
   * gets to say who it is for.
   *
   * What it can do is exactly what the person it names could do from a device
   * that is not in the call — turn it down while it rings — and nothing once
   * it is answered, which `endCallByParty` refuses for anything that cannot
   * prove it is in the call.
   */
  app.post(
    '/calls/:callId/decline',
    {
      schema: { params: callRefSchema },
      config: { rateLimit: limit(30, '1 minute') },
    },
    async (request, reply) => {
      const { callId } = request.params
      const ticket = request.headers[CALL_TOKEN_HEADER]
      const call = await findCall(app.mongo.db, callId)
      // One answer for "no such call", "no ticket" and "not your ticket": a
      // route that told them apart would confirm which call ids are real.
      if (
        !call ||
        typeof ticket !== 'string' ||
        !verifyCallToken(app.env.BETTER_AUTH_SECRET, ticket, { callId, userId: call.calleeId })
      ) {
        throw new ApiError(ERROR_CODES.NOT_FOUND, 'Call not found')
      }
      return reply.send(await endCallByParty(app, call.calleeId, { callId }, { inRoom: false }))
    },
  )

  /**
   * A phone saying it can be rung while its app is not running.
   *
   * Idempotent, and sent on every launch: a PushKit token changes without
   * notice, and this is how the server finds out.
   */
  app.put(
    '/me/call-endpoint',
    { preHandler: requireVerifiedEmail, schema: { body: registerCallEndpointSchema } },
    async (request, reply) => {
      await registerCallEndpoint(app.mongo.db, request.userId, request.body)
      return reply.code(204).send()
    },
  )
}
