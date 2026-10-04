import { z } from 'zod'

/**
 * Calls: two people in a conversation talking out loud, with or without their
 * cameras.
 *
 * The contract for it lives here because three things have to agree about
 * every name below and none of them can see the others: the API that keeps the
 * call's state, the JavaScript that carries the media, and the native code
 * that rings a phone whose app is not running.
 *
 * What the server owns is small on purpose. It decides who may call whom, it
 * holds the one document that says what state a call is in, and it relays the
 * handful of messages two devices need to find each other. The sound and the
 * picture never touch it — they travel between the two devices, encrypted end
 * to end, through a relay that only ever sees ciphertext.
 */
export const CALL_MEDIA = ['audio', 'video'] as const
export type CallMedia = (typeof CALL_MEDIA)[number]

/**
 * Where a call is, and it only moves forwards.
 *
 * `connecting` is its own state rather than part of `ringing` because the two
 * fail differently: nobody picking up is a missed call, and somebody picking
 * up whose devices then cannot reach each other is a failed one. The log row
 * says which, and it can only do that if the server knew the answer happened.
 */
export const CALL_STATES = ['ringing', 'connecting', 'active', 'ended'] as const
export type CallState = (typeof CALL_STATES)[number]

/**
 * What a call turned out to be, as the thread remembers it.
 *
 * Five, and deliberately not the list of reasons a call can end: a row in a
 * conversation answers "did we talk", and a dozen causes all answer that the
 * same few ways. `busy` is kept apart from `missed` only so the caller's own
 * screen can say something truer than "no answer"; the person who was busy
 * reads both as a call they did not take.
 */
export const CALL_OUTCOMES = ['completed', 'missed', 'declined', 'busy', 'failed'] as const
export type CallOutcome = (typeof CALL_OUTCOMES)[number]

/** The outcomes in which nobody picked up — what the cooldown counts. */
export function isUnansweredOutcome(outcome: CallOutcome): boolean {
  return outcome === 'missed' || outcome === 'declined' || outcome === 'busy'
}

/**
 * Why a call ended, as a client is told.
 *
 * Shorter than the server's own list. A block, a suspension and a deleted
 * account all arrive as `ended`: which of them it was is not the other
 * person's to know, and a reason that named it would tell somebody they had
 * just been blocked at the precise moment it would sting most.
 */
export const CALL_END_REASONS = [
  'hangup',
  'cancelled',
  'declined',
  'timeout',
  'answeredElsewhere',
  'busy',
  'connectFailed',
  'connectionLost',
  'maxDuration',
  'ended',
] as const
export type CallEndReason = (typeof CALL_END_REASONS)[number]

/**
 * Every number a call is bounded by.
 *
 * Config for the reason `PLAN_LIMITS` is: a threshold read at a call site is a
 * threshold that gets copied, and the client's ring timer, the server's
 * deadline and the push's expiry are three places that must say the same 45.
 * None of these is a plan limit — calling is free on every plan — so they live
 * here rather than there.
 */
export const CALL_LIMITS = {
  /**
   * How long a call rings before it is a missed one. Long enough to find a
   * phone in a bag; short enough that the caller is not left listening to a
   * tone nobody is going to answer.
   */
  ringSeconds: 45,
  /** From the answer to media flowing. Past this the devices never found each other. */
  connectTimeoutSeconds: 30,
  /**
   * The longest one call may run. Two hours is far past any practice session,
   * and the bound exists for the relay bill and for two idle accounts leaving
   * a line open overnight rather than for anybody actually talking.
   */
  maxDurationMinutes: 120,
  /** How often each device says "still here" while a call is up. */
  heartbeatSeconds: 30,
  /**
   * How long the server believes a call whose devices have gone quiet. Three
   * heartbeats, so one lost on a bad network or swallowed by a deploy is a
   * gap and not a hang-up.
   */
  leaseSeconds: 90,
  /** Calls one account may start in an hour, answered or not. */
  startsPerHour: 20,
  /**
   * Unanswered calls to one person in a day before the caller has to wait for
   * them to write or call back. Three is "I really was trying to reach you";
   * the fourth is a phone that will not stop ringing.
   */
  unansweredPerPerson24h: 3,
  /** How much longer than the longest call the relay credentials stay good. */
  turnTtlMarginMinutes: 10,
  /** A session description is a few kilobytes; this is a ceiling, not a size. */
  sdpMaxBytes: 32_768,
  /** Candidates travel in batches, and a batch is never larger than this. */
  candidatesPerSignal: 20,
  /**
   * How long a device collects candidates before sending them. Each signal is
   * one write on the bus between API machines, so a candidate per frame would
   * be a dozen writes where two will do.
   */
  candidateBatchMs: 200,
  /**
   * How early an agreed time to talk offers "Call now" on its card. Ten
   * minutes, so somebody who is ready early can start — and not the hour the
   * reminder buzzes, when a call is a surprise rather than the plan.
   */
  meetingCallLeadMinutes: 10,
} as const

/**
 * The version of this protocol a client speaks.
 *
 * A client that can take a call says so when its socket connects, the way it
 * names the inbox kinds it can draw — and for the same reason: the version
 * header names a binary, which says nothing about the JavaScript running in
 * it or whether that JavaScript has a media engine to call with. Only a
 * declaration does. A socket that declares nothing is never rung and never
 * shown a call button's worth of promises.
 */
export const CALL_PROTOCOL_VERSION = 1
export const CALLS_AUTH_KEY = 'calls'

/**
 * The protocol a socket declared, or `null` for one that declared none.
 *
 * `unknown` because it arrives in the socket's `auth`, which is client input
 * and may be anything. A version newer than this server's is accepted as this
 * server's: the client will speak the older one, which is the whole meaning
 * of a version that only ever grows.
 */
export function acceptedCallProtocol(declared: unknown): number | null {
  const version = typeof declared === 'string' ? Number.parseInt(declared, 10) : declared
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return null
  return Math.min(version, CALL_PROTOCOL_VERSION)
}

/**
 * Event names, once.
 *
 * The rest of the socket's events are string literals at both ends, which has
 * held because each is used in two places. A call uses a dozen from four —
 * the API, the session, the web engine and the native bridge — and a typo in
 * one of them is not an error anywhere: it is a call that rings forever.
 */
export const CALL_EVENTS = {
  // client → server, each answered through its ack
  start: 'call:start',
  accept: 'call:accept',
  end: 'call:end',
  connected: 'call:connected',
  heartbeat: 'call:heartbeat',
  resume: 'call:resume',
  status: 'call:status',
  // both ways: sent by one device, relayed to the other
  ringing: 'call:ringing',
  signal: 'call:signal',
  media: 'call:media',
  // server → client
  incoming: 'call:incoming',
  accepted: 'call:accepted',
  ended: 'call:ended',
} as const

/**
 * A call's id is a UUID, minted by the device that starts it.
 *
 * By the caller rather than the server so that a start whose ack was lost can
 * be retried without ringing twice — the second insert finds the first. A
 * UUID rather than an ObjectId because it is also the identifier CallKit keys
 * a call on, and CallKit accepts nothing else.
 */
export const callIdSchema = z.uuid()

export const startCallSchema = z.object({
  callId: callIdSchema,
  conversationId: z.string().trim().min(1),
  media: z.enum(CALL_MEDIA),
})
export type StartCallInput = z.infer<typeof startCallSchema>

export const callRefSchema = z.object({ callId: callIdSchema })
export type CallRefInput = z.infer<typeof callRefSchema>

/**
 * Ending a call, whoever is asking and whenever.
 *
 * One event rather than a cancel, a decline and a hang-up, because the three
 * differ only in who sends them and when — and the server already knows both.
 * A caller ending a ringing call cancelled it; the other person ending it
 * declined; either of them ending anything later hung up.
 *
 * `reason` is the device explaining itself, for the two endings that are not
 * a person's choice. The server treats it as a hint and never as authority:
 * it changes which word the log uses, not whether the call ends.
 */
export const endCallSchema = z.object({
  callId: callIdSchema,
  reason: z.enum(['user', 'connectFailed', 'connectionLost']).optional(),
  /**
   * Proof of being a device *in* the call, for the request that does not
   * arrive on the call's own socket — a hang-up sent over REST because the
   * socket is the thing that died. Not needed while a call is still ringing,
   * when any of either person's devices may end it. See `resumeCallSchema`.
   */
  resumeKey: z.string().min(16).max(128).optional(),
})
export type EndCallInput = z.infer<typeof endCallSchema>

/**
 * Rejoining a call after the socket dropped under it.
 *
 * The key is handed to each side once, in the ack that made it a party, and
 * is what stands in for "this is the device that was in the call". A socket
 * id cannot do that — it changes on every reconnect, which is exactly when
 * this is needed — and the account alone must not: a second phone signed in
 * to the same account is not in the call and should not be able to walk into
 * its signalling.
 */
export const resumeCallSchema = z.object({
  callId: callIdSchema,
  resumeKey: z.string().min(16).max(128),
})
export type ResumeCallInput = z.infer<typeof resumeCallSchema>

const iceCandidateSchema = z.object({
  candidate: z.string().max(1024),
  sdpMid: z.string().max(64).nullable().optional(),
  sdpMLineIndex: z.number().int().min(0).max(16).nullable().optional(),
  usernameFragment: z.string().max(256).nullable().optional(),
})
export type CallIceCandidate = z.infer<typeof iceCandidateSchema>

/**
 * What two devices say to each other to set up the media path, passed through
 * the server unread.
 *
 * Bounded all the same. The server relays this to another person's device, so
 * an unbounded string here is a megabyte somebody else's phone has to parse.
 * At least one of the four has to be present: an empty signal is a frame that
 * costs a relay and means nothing.
 */
export const callSignalSchema = z
  .object({
    callId: callIdSchema,
    description: z
      .object({
        type: z.enum(['offer', 'answer']),
        sdp: z.string().min(1).max(CALL_LIMITS.sdpMaxBytes),
      })
      .optional(),
    candidates: z.array(iceCandidateSchema).min(1).max(CALL_LIMITS.candidatesPerSignal).optional(),
    endOfCandidates: z.literal(true).optional(),
    /** The answering side asking the caller to restart ICE; only the caller offers. */
    restart: z.literal(true).optional(),
  })
  .refine(
    (signal) =>
      signal.description !== undefined ||
      signal.candidates !== undefined ||
      signal.endOfCandidates !== undefined ||
      signal.restart !== undefined,
    'A signal has to carry something',
  )
export type CallSignal = z.infer<typeof callSignalSchema>

/**
 * "My camera is on", "my microphone is muted" — for the other screen to draw.
 *
 * Told rather than inferred from the media, because a muted track and a quiet
 * room look the same from the far end and only one of them should put a
 * crossed-out microphone on somebody's face.
 */
export const callMediaStateSchema = z.object({
  callId: callIdSchema,
  audio: z.boolean(),
  video: z.boolean(),
})
export type CallMediaState = z.infer<typeof callMediaStateSchema>

/** A call, as either of the two people in it is told about it. */
export const callViewSchema = z.object({
  callId: callIdSchema,
  conversationId: z.string(),
  media: z.enum(CALL_MEDIA),
  state: z.enum(CALL_STATES),
  callerId: z.string(),
  calleeId: z.string(),
  /** When ringing gives up, ISO. */
  ringDeadline: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  connectedAt: z.iso.datetime().optional(),
  /**
   * The server's clock when this was written. Every deadline above is on that
   * clock, and a phone's own can be minutes out — a ring timer counted against
   * the device's idea of now would give up early or never.
   */
  serverNow: z.iso.datetime(),
})
export type CallView = z.infer<typeof callViewSchema>

/** As much of the other person as a ringing screen draws. */
export const callPeerSchema = z.object({
  _id: z.string(),
  handle: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().optional(),
})
export type CallPeer = z.infer<typeof callPeerSchema>

export const callIncomingSchema = z.object({ call: callViewSchema, caller: callPeerSchema })
export type CallIncoming = z.infer<typeof callIncomingSchema>

/**
 * Where the media may travel, minted per person per call.
 *
 * `relay` is what production sends: every packet goes through the relay and
 * neither device is ever told the other's address. It costs a hop, and it is
 * the difference between calling a stranger and handing them your IP.
 */
export const iceConfigSchema = z.object({
  iceServers: z.array(
    z.object({
      urls: z.union([z.string(), z.array(z.string())]),
      username: z.string().optional(),
      credential: z.string().optional(),
    }),
  ),
  iceTransportPolicy: z.enum(['all', 'relay']),
})
export type IceConfig = z.infer<typeof iceConfigSchema>

/** What starting or answering a call hands back: the call, the path, the key. */
export const callSessionSchema = z.object({
  call: callViewSchema,
  ice: iceConfigSchema,
  resumeKey: z.string(),
})
export type CallSession = z.infer<typeof callSessionSchema>

export const callEndedSchema = z.object({
  callId: callIdSchema,
  reason: z.enum(CALL_END_REASONS),
  outcome: z.enum(CALL_OUTCOMES).optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
})
export type CallEnded = z.infer<typeof callEndedSchema>

/**
 * `GET /calls/current` — the live call this account is in, or being rung for.
 *
 * Asked when the app comes forward and when a socket reconnects, because both
 * are moments a `call:incoming` may have been sent to nobody.
 */
export const currentCallSchema = z.object({
  call: callViewSchema,
  peer: callPeerSchema,
  role: z.enum(['caller', 'callee']),
})
export type CurrentCall = z.infer<typeof currentCallSchema>

/**
 * A call as a message carries it: the row a finished call leaves in a thread.
 *
 * `outcome` is the same for both readers and the wording is not — "missed" is
 * the callee's word and "no answer" the caller's — so the row stores the fact
 * and each client words it from where it stands.
 */
export const messageCallSchema = z.object({
  callId: callIdSchema,
  media: z.enum(CALL_MEDIA),
  outcome: z.enum(CALL_OUTCOMES),
  durationSeconds: z.number().int().nonnegative().optional(),
})
export type MessageCall = z.infer<typeof messageCallSchema>

export const CALL_ENDPOINT_PLATFORMS = ['ios', 'android'] as const
export type CallEndpointPlatform = (typeof CALL_ENDPOINT_PLATFORMS)[number]

export const APNS_ENVIRONMENTS = ['sandbox', 'production'] as const
export type ApnsEnvironment = (typeof APNS_ENVIRONMENTS)[number]

/**
 * `PUT /me/call-endpoint` — a phone saying it can be rung while its app is
 * not running, and how.
 *
 * Apart from the push `devices` row on purpose. That row exists only once
 * somebody has allowed notifications, and a PushKit token needs no such
 * permission: an iPhone that refused notifications can still take a call, and
 * should. `deviceId` is the same installation id the push registration sends,
 * which is what lets the two be matched when both exist.
 */
export const registerCallEndpointSchema = z.object({
  deviceId: z.string().trim().min(1).max(128),
  platform: z.enum(CALL_ENDPOINT_PLATFORMS),
  protocol: z.number().int().min(1),
  /** The PushKit token, hex. iOS only. */
  voipToken: z
    .string()
    .regex(/^[0-9a-f]{64,200}$/)
    .optional(),
  /**
   * Which of Apple's two push hosts the token belongs to. A token minted by a
   * development build is refused by the production host and the other way
   * round, and only the app knows which kind of build it is.
   */
  apnsEnvironment: z.enum(APNS_ENVIRONMENTS).optional(),
  /**
   * Whether this phone may use the system call screen. `false` where CallKit
   * is not allowed — the phone is then rung with an ordinary notification.
   */
  callKit: z.boolean().optional(),
})
export type RegisterCallEndpointInput = z.infer<typeof registerCallEndpointSchema>

/**
 * The two pushes that are never drawn as notifications: one starts a phone
 * ringing, the other stops it.
 *
 * Not `PUSH_KINDS`, for the reason `TRAY_SYNC_KIND` is not: those are things a
 * person reads and taps. These are instructions to native code, which turns
 * the first into the system's incoming-call screen before any JavaScript is
 * running.
 */
export const CALL_RING_KIND = 'callRing'
export const CALL_CANCEL_KIND = 'callCancel'
export const CALL_PUSH_KINDS = [CALL_RING_KIND, CALL_CANCEL_KIND] as const
export type CallPushKind = (typeof CALL_PUSH_KINDS)[number]

export function isCallPushKind(kind: unknown): kind is CallPushKind {
  return kind === CALL_RING_KIND || kind === CALL_CANCEL_KIND
}

/**
 * Everything a phone needs to ring without asking anybody anything.
 *
 * The name and the picture travel in the push because the app may not be
 * running to look them up, and a call from "Unknown" is a call nobody
 * answers. `callToken` is what lets native code decline with no session in
 * reach: a locked iPhone cannot read the app's cookie out of the Keychain, and
 * a decline that waited for an unlock would not be one.
 */
export const callRingDataSchema = z.object({
  kind: z.literal(CALL_RING_KIND),
  callId: callIdSchema,
  conversationId: z.string(),
  media: z.enum(CALL_MEDIA),
  callerId: z.string(),
  callerName: z.string(),
  callerHandle: z.string(),
  callerAvatarUrl: z.string().optional(),
  /** Seconds of ringing left when this was sent — relative, so no clock has to agree. */
  ringSeconds: z.number().int().positive(),
  callToken: z.string(),
})
export type CallRingData = z.infer<typeof callRingDataSchema>

export const callCancelDataSchema = z.object({
  kind: z.literal(CALL_CANCEL_KIND),
  callId: callIdSchema,
  reason: z.enum(CALL_END_REASONS),
})
export type CallCancelData = z.infer<typeof callCancelDataSchema>

/** The header a `callToken` travels in, on the one route that takes it: `POST /calls/:id/decline`. */
export const CALL_TOKEN_HEADER = 'x-call-token'
