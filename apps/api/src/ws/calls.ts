import {
  CALL_EVENTS,
  ERROR_CODES,
  callMediaStateSchema,
  callRefSchema,
  callSignalSchema,
  endCallSchema,
  resumeCallSchema,
  startCallSchema,
  type ApiErrorBody,
} from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import { ApiError } from '../lib/ApiError'
import {
  acceptCall,
  callStatus,
  endCallByParty,
  heartbeatCall,
  markCallConnected,
  relayRinging,
  resumeCall,
  startCall,
} from '../modules/calls/service'
import { callRoom, type AppSocket } from './types'

/**
 * `code` is a plain string here rather than `ErrorCode`, only so the
 * connection's own rate limiter — which answers through the same ack with the
 * chat handlers' narrower shape — can be handed one of these.
 */
type CallAckResponse =
  { ok: true; data?: unknown } | { ok: false; error: Omit<ApiErrorBody, 'code'> & { code: string } }
type CallAck = ((response: CallAckResponse) => void) | undefined

/**
 * The refusal, with everything REST would have sent beside the code.
 *
 * The chat handlers' `errorPayload` keeps only the code and the message, which
 * has been enough for them. A call's refusals are not readable without the
 * rest: `CALL_COOLDOWN` is a date, `CALLS_LOCKED` is a number, and
 * `CALLS_REFUSED` is which of the two people said no. `toBody` is what the
 * HTTP error handler sends, so the two transports say the same thing.
 */
function callError(error: unknown): ApiErrorBody {
  if (error instanceof ApiError) return error.toBody()
  if (error instanceof ZodError) {
    return { code: ERROR_CODES.VALIDATION_FAILED, message: 'Invalid payload' }
  }
  return { code: ERROR_CODES.INTERNAL, message: 'Something went wrong' }
}

/** A relay asked for by a socket that is not in the call. */
function notInCall(): ApiErrorBody {
  return { code: ERROR_CODES.CALL_ENDED, message: 'You are not in that call' }
}

export interface CallHandlerDeps {
  app: FastifyInstance
  socket: AppSocket
  userId: string
  /** The connection's rate limit — see `ws/index.ts`. Named buckets, in `ws/rateLimit.ts`. */
  limited: (event: string, ack: CallAck) => boolean
}

/**
 * The socket's side of a call.
 *
 * Two kinds of handler live here, and the difference between them is the
 * design.
 *
 * **The ones that change a call** — start, accept, end, connected, heartbeat,
 * resume — go through `modules/calls/service`, which is where every guard is.
 * These handlers validate, call, and answer; they decide nothing, for the
 * reason the chat handlers decide nothing.
 *
 * **The ones that relay** — signal, media — touch no database at all. They
 * pass a frame to the other socket in the call's room if and only if the
 * sender is in that room too, and membership of the room is only ever granted
 * by one of the guarded handlers above (`callRoom` says which three). That is
 * what makes it safe for the hottest path in a call to be a set lookup: a
 * dozen candidates a second must not each cost a read, and they do not need
 * to, because the question "may this socket talk to that one" was answered
 * once, when it joined.
 */
export function registerCallHandlers({ app, socket, userId, limited }: CallHandlerDeps): void {
  const deviceId = socket.data.deviceId
  const origin = { socket, ...(deviceId ? { deviceId } : {}) }
  const inRoom = (callId: string): boolean => socket.rooms.has(callRoom(callId))

  /**
   * Answers a failed handler through its ack — and says so in the log when the
   * failure was not one of ours. An `ApiError` is a refusal working as
   * designed; anything else reaches the client as a bare `INTERNAL`, and
   * without this line that word would be the only trace of it anywhere.
   */
  const refuse =
    (event: string, ack: CallAck) =>
    (error: unknown): void => {
      if (!(error instanceof ApiError) && !(error instanceof ZodError)) {
        app.log.error({ err: error, event, userId }, 'call handler failed')
      }
      ack?.({ ok: false, error: callError(error) })
    }

  socket.on(CALL_EVENTS.start, (payload: unknown, ack: CallAck) => {
    if (!limited(CALL_EVENTS.start, ack)) return
    startCallSchema
      .parseAsync(payload)
      .then((input) => startCall(app, userId, input, origin))
      .then((session) => ack?.({ ok: true, data: session }))
      .catch(refuse(CALL_EVENTS.start, ack))
  })

  socket.on(CALL_EVENTS.accept, (payload: unknown, ack: CallAck) => {
    if (!limited('call:control', ack)) return
    callRefSchema
      .parseAsync(payload)
      .then(({ callId }) => acceptCall(app, userId, callId, origin))
      .then((session) => ack?.({ ok: true, data: session }))
      .catch(refuse(CALL_EVENTS.accept, ack))
  })

  socket.on(CALL_EVENTS.end, (payload: unknown, ack: CallAck) => {
    if (!limited('call:control', ack)) return
    endCallSchema
      .parseAsync(payload)
      .then((input) => endCallByParty(app, userId, input, { inRoom: inRoom(input.callId) }))
      .then((ended) => ack?.({ ok: true, data: ended }))
      .catch(refuse(CALL_EVENTS.end, ack))
  })

  socket.on(CALL_EVENTS.resume, (payload: unknown, ack: CallAck) => {
    if (!limited('call:control', ack)) return
    resumeCallSchema
      .parseAsync(payload)
      .then((input) => resumeCall(app, userId, input, socket))
      .then((call) => ack?.({ ok: true, data: { call } }))
      .catch(refuse(CALL_EVENTS.resume, ack))
  })

  /*
   * Only from a socket in the call. `claimConnected` matches on the account,
   * and a second device of the same account — one that was told "answered
   * elsewhere" — must not be able to start the clock on a call it is not in.
   */
  socket.on(CALL_EVENTS.connected, (payload: unknown, ack: CallAck) => {
    if (!limited('call:state', ack)) return
    callRefSchema
      .parseAsync(payload)
      .then(({ callId }) => {
        if (!inRoom(callId)) throw new ApiError(ERROR_CODES.CALL_ENDED, 'You are not in that call')
        return markCallConnected(app, userId, callId)
      })
      .then((call) => ack?.({ ok: true, data: { call } }))
      .catch(refuse(CALL_EVENTS.connected, ack))
  })

  socket.on(CALL_EVENTS.heartbeat, (payload: unknown, ack: CallAck) => {
    if (!limited('call:state', ack)) return
    callRefSchema
      .parseAsync(payload)
      .then(({ callId }) => {
        if (!inRoom(callId)) throw new ApiError(ERROR_CODES.CALL_ENDED, 'You are not in that call')
        return heartbeatCall(app, userId, callId)
      })
      .then(() => ack?.({ ok: true }))
      .catch(refuse(CALL_EVENTS.heartbeat, ack))
  })

  socket.on(CALL_EVENTS.status, (payload: unknown, ack: CallAck) => {
    if (!limited('call:state', ack)) return
    callRefSchema
      .parseAsync(payload)
      .then(({ callId }) => callStatus(app, userId, callId))
      .then((status) => ack?.({ ok: true, data: status }))
      .catch(refuse(CALL_EVENTS.status, ack))
  })

  // "A phone of mine is ringing." Best-effort like `typing`: it changes one
  // word on the caller's screen, and a lost one costs nothing.
  socket.on(CALL_EVENTS.ringing, (payload: unknown, ack: CallAck) => {
    if (!limited('call:state', ack)) return
    callRefSchema
      .parseAsync(payload)
      .then(({ callId }) => relayRinging(app, userId, callId))
      .then(() => ack?.({ ok: true }))
      .catch(refuse(CALL_EVENTS.ringing, ack))
  })

  socket.on(CALL_EVENTS.signal, (payload: unknown, ack: CallAck) => {
    if (!limited(CALL_EVENTS.signal, ack)) return
    const parsed = callSignalSchema.safeParse(payload)
    if (!parsed.success) {
      ack?.({ ok: false, error: callError(parsed.error) })
      return
    }
    if (!inRoom(parsed.data.callId)) {
      ack?.({ ok: false, error: notInCall() })
      return
    }
    // The parsed value, not the payload: what reaches the other device is
    // exactly what the schema allowed and nothing that rode along beside it.
    socket.to(callRoom(parsed.data.callId)).emit(CALL_EVENTS.signal, parsed.data)
    ack?.({ ok: true })
  })

  socket.on(CALL_EVENTS.media, (payload: unknown, ack: CallAck) => {
    if (!limited(CALL_EVENTS.media, ack)) return
    const parsed = callMediaStateSchema.safeParse(payload)
    if (!parsed.success) {
      ack?.({ ok: false, error: callError(parsed.error) })
      return
    }
    if (!inRoom(parsed.data.callId)) {
      ack?.({ ok: false, error: notInCall() })
      return
    }
    socket.to(callRoom(parsed.data.callId)).emit(CALL_EVENTS.media, parsed.data)
    ack?.({ ok: true })
  })
}
