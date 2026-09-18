import { createHmac, timingSafeEqual } from 'node:crypto'
import { COMMENT_TO_DM_RULES, ERROR_CODES } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { ApiError } from '../lib/ApiError'
import { decideForComment, decideForMessage, type GrowthAction } from '../modules/growth/flow'
import { createGraph, type InstagramGraph } from '../modules/growth/graph'
import {
  ASK_TO_FOLLOW,
  DELIVERY,
  PRIVATE_REPLIES,
  PUBLIC_REPLIES,
  pick,
} from '../modules/growth/messages'
import {
  claimComment,
  countFollowAsk,
  markDelivered,
  recordInboundMessage,
} from '../modules/growth/repo'

/**
 * "Comment LANGX and I'll DM you the link", as the API actually permits it.
 *
 * Instagram ranks a post carrying a link below one that does not, so the link
 * moves into a direct message — and a business may only send one to somebody
 * who acted first. The comment is that action, and it buys exactly one private
 * reply. The order that follows is in `modules/growth/flow.ts`, and it is not
 * the order every guide to this draws: whether somebody follows the account is
 * unreadable until they have messaged us, so the follow check comes after the
 * private reply rather than before it.
 *
 * Unconfigured — no `IG_APP_SECRET` — the routes answer that they are not set
 * up, the same as the Resend webhook next door, and the rest of the API boots
 * and runs exactly as before.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const instagramWebhookRoutes: FastifyPluginAsyncZod = async (app) => {
  // Scoped to this plugin: the signature is over the bytes Meta sent, and
  // Fastify's JSON parser would have consumed them.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
    done(null, body)
  })

  const graphFor = (): InstagramGraph | null => {
    const { IG_ACCOUNT_ID, IG_PAGE_TOKEN } = app.env
    if (!IG_ACCOUNT_ID || !IG_PAGE_TOKEN) return null
    return createGraph({ accountId: IG_ACCOUNT_ID, token: IG_PAGE_TOKEN })
  }

  /**
   * Meta's subscription handshake: it calls this once with a token we chose,
   * and expects the challenge echoed back as plain text. Anything else — a
   * JSON wrapper included — and the subscription is refused.
   */
  app.get('/webhooks/instagram', async (request, reply) => {
    const expected = app.env.IG_VERIFY_TOKEN
    if (!expected) throw new ApiError(ERROR_CODES.INTERNAL, 'Instagram webhooks are not configured')

    const query = request.query as Record<string, string | undefined>
    if (query['hub.mode'] !== 'subscribe' || query['hub.verify_token'] !== expected) {
      throw new ApiError(ERROR_CODES.UNAUTHENTICATED, 'Bad verify token')
    }
    return reply.type('text/plain').send(query['hub.challenge'] ?? '')
  })

  app.post(
    '/webhooks/instagram',
    {
      config: {
        rateLimit: { max: COMMENT_TO_DM_RULES.privateRepliesPerHour, timeWindow: '1 hour' },
      },
    },
    async (request, reply) => {
      const secret = app.env.IG_APP_SECRET
      if (!secret) throw new ApiError(ERROR_CODES.INTERNAL, 'Instagram webhooks are not configured')

      const raw = typeof request.body === 'string' ? request.body : JSON.stringify(request.body)
      const header = request.headers['x-hub-signature-256']
      if (!verifySignature(raw, Array.isArray(header) ? header[0] : header, secret)) {
        throw new ApiError(ERROR_CODES.UNAUTHENTICATED, 'Invalid webhook signature')
      }

      const graph = graphFor()
      /*
       * Acknowledge first, work after.
       *
       * Meta retries anything it does not get a prompt 200 for, and the work
       * below deliberately sleeps for up to ninety seconds before answering a
       * comment — an account that replies within the same second reads as a
       * machine to everybody watching. Waiting for that inside the request
       * would guarantee the retry, and the retry would be a second attempt at
       * a private reply the platform only allows once.
       */
      void handle(parse(raw), graph).catch((caught: unknown) => {
        request.log.error({ err: caught }, 'instagram webhook handling failed')
      })
      return reply.send({ received: true })
    },
  )

  async function handle(events: ParsedEvent[], graph: InstagramGraph | null): Promise<void> {
    for (const event of events) {
      const action =
        event.kind === 'comment'
          ? decideForComment(event, {
              seen: !(await claimComment(app.mongo.db, event.commentId)),
              selfId: app.env.IG_ACCOUNT_ID ?? '',
              postedAt: event.postedAt,
              now: new Date(),
            })
          : await decideForMessageEvent(event, graph)

      if (action.kind === 'ignore') {
        app.log.debug({ because: action.because }, 'instagram event ignored')
        continue
      }
      if (!graph) {
        app.log.warn('instagram action skipped: no page token configured')
        continue
      }
      await perform(action, graph)
    }
  }

  async function decideForMessageEvent(
    event: Extract<ParsedEvent, { kind: 'message' }>,
    graph: InstagramGraph | null,
  ): Promise<GrowthAction> {
    const lead = await recordInboundMessage(app.mongo.db, event.senderId, event.at)
    // Asked now and not at comment time because now is the first moment Meta
    // will answer it.
    const follows = graph ? await graph.follows(event.senderId) : false
    return decideForMessage(event, {
      follows,
      delivered: lead.deliveredAt !== undefined,
      withinWindow: Date.now() - event.at.getTime() < COMMENT_TO_DM_RULES.conversationWindowMs,
    })
  }

  async function perform(action: GrowthAction, graph: InstagramGraph): Promise<void> {
    switch (action.kind) {
      case 'answerComment': {
        await sleep(action.delayMs)
        await graph.replyToComment(action.commentId, pick(PUBLIC_REPLIES))
        await graph.sendPrivateReply(action.commentId, pick(PRIVATE_REPLIES))
        return
      }
      case 'deliver': {
        await graph.sendMessage(action.recipientId, DELIVERY)
        await markDelivered(app.mongo.db, action.recipientId)
        return
      }
      case 'askToFollow': {
        // Once. A second reminder to somebody who has already been asked is
        // the difference between a nudge and being harassed by a brand.
        const asks = await countFollowAsk(app.mongo.db, action.recipientId)
        if (asks > 1) return
        await graph.sendMessage(action.recipientId, ASK_TO_FOLLOW)
        return
      }
      default:
        return
    }
  }
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

/** Constant time, and only after the lengths match — `timingSafeEqual` throws otherwise. */
function verifySignature(body: string, header: string | undefined, secret: string): boolean {
  if (!header?.startsWith('sha256=')) return false
  const expected = createHmac('sha256', secret).update(body).digest()
  const given = Buffer.from(header.slice('sha256='.length), 'hex')
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export type ParsedEvent =
  | { kind: 'comment'; commentId: string; text: string; fromId: string; postedAt: Date }
  | { kind: 'message'; senderId: string; text: string; at: Date }

/**
 * The two shapes worth reading out of a webhook body, and nothing else.
 *
 * Deliberately tolerant rather than schema-validated: Meta adds fields to
 * these payloads without warning, and a strict parse would turn a new one into
 * a dropped lead. Anything unrecognised is simply not an event.
 */
export function parse(raw: string): ParsedEvent[] {
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return []
  }
  const entries = (body as { entry?: unknown[] }).entry
  if (!Array.isArray(entries)) return []

  const events: ParsedEvent[] = []
  for (const entry of entries) {
    const { changes, messaging } = entry as { changes?: unknown[]; messaging?: unknown[] }

    for (const change of Array.isArray(changes) ? changes : []) {
      const { field, value } = change as { field?: string; value?: Record<string, unknown> }
      if (field !== 'comments' || !value) continue
      const from = value.from as { id?: string } | undefined
      if (typeof value.id !== 'string' || typeof value.text !== 'string') continue
      events.push({
        kind: 'comment',
        commentId: value.id,
        text: value.text,
        fromId: from?.id ?? '',
        // Instagram sends seconds; a missing timestamp means now, which keeps
        // the seven-day check from rejecting a payload it cannot date.
        postedAt:
          typeof value.timestamp === 'number' ? new Date(value.timestamp * 1000) : new Date(),
      })
    }

    for (const item of Array.isArray(messaging) ? messaging : []) {
      const { sender, message, timestamp } = item as {
        sender?: { id?: string }
        message?: { text?: string; is_echo?: boolean }
        timestamp?: number
      }
      // An echo is our own message coming back; answering it is a loop.
      if (message?.is_echo === true) continue
      if (!sender?.id || typeof message?.text !== 'string') continue
      events.push({
        kind: 'message',
        senderId: sender.id,
        text: message.text,
        at: typeof timestamp === 'number' ? new Date(timestamp) : new Date(),
      })
    }
  }
  return events
}
