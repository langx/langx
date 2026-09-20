import { createHmac, timingSafeEqual } from 'node:crypto'
import { COMMENT_TO_DM_RULES, ERROR_CODES } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { ApiError } from '../lib/ApiError'
import { createGraph, type InstagramGraph } from '../modules/growth/graph'
import { handleEvents, type ParsedEvent } from '../modules/growth/handle'

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
    // Only the token is required now: the account id comes from `/me`, and
    // `IG_ACCOUNT_ID` is the fallback for when that call cannot be made.
    if (!IG_PAGE_TOKEN) return null
    return createGraph({
      token: IG_PAGE_TOKEN,
      ...(IG_ACCOUNT_ID ? { fallbackAccountId: IG_ACCOUNT_ID } : {}),
    })
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
      void handleEvents(parse(raw), {
        db: app.mongo.db,
        graph,
        ...(app.env.IG_ACCOUNT_ID ? { fallbackAccountId: app.env.IG_ACCOUNT_ID } : {}),
        log: app.log,
      }).catch((caught: unknown) => {
        request.log.error({ err: caught }, 'instagram webhook handling failed')
      })
      return reply.send({ received: true })
    },
  )
}

/** Constant time, and only after the lengths match — `timingSafeEqual` throws otherwise. */
function verifySignature(body: string, header: string | undefined, secret: string): boolean {
  if (!header?.startsWith('sha256=')) return false
  const expected = createHmac('sha256', secret).update(body).digest()
  const given = Buffer.from(header.slice('sha256='.length), 'hex')
  return given.length === expected.length && timingSafeEqual(given, expected)
}

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
      const { sender, message, postback, timestamp, is_self } = item as {
        sender?: { id?: string }
        message?: { text?: string; is_echo?: boolean }
        postback?: { payload?: string }
        timestamp?: number
        is_self?: boolean
      }
      // An echo is our own message coming back; answering it is a loop.
      if (message?.is_echo === true) continue
      /*
       * `is_self` is the same hazard wearing the other hat: a CTA on our own
       * account reports a postback whose `sender.id` is *us*. Without this it
       * becomes a lead keyed by the account's own id, which then gets DMs.
       */
      if (is_self === true) continue
      /*
       * A tapped button arrives as `postback` rather than `message`, and is
       * treated as the same thing: what this flow needs from the person is
       * that they acted, because acting is what opens the 24-hour window and
       * makes `is_user_follow_business` readable. The payload stands in for
       * what they would have typed.
       */
      const text = typeof message?.text === 'string' ? message.text : postback?.payload
      /*
       * `typeof`, not truthiness, and it matters: this id goes straight into a
       * Mongo `_id`, so a body carrying `{"sender":{"id":{"$ne":null}}}` would
       * otherwise match every lead in the collection. The signature check
       * upstream means only Meta can send one, which narrows who could do it
       * to nobody — and is exactly the argument that stops being true the day
       * a second caller is added.
       */
      if (typeof sender?.id !== 'string' || typeof text !== 'string') continue
      events.push({
        kind: 'message',
        senderId: sender.id,
        text,
        at: typeof timestamp === 'number' ? new Date(timestamp) : new Date(),
      })
    }
  }
  return events
}
