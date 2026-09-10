import { ERROR_CODES } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { Resend } from 'resend'
import { ApiError } from '../lib/ApiError'
import { suppressEmail, type SuppressionReason } from '../modules/notifications/suppressions'

/**
 * What Resend tells us about mail after it left, and the one thing we do
 * with it: stop writing to an address that has proved dead or hostile.
 *
 * Three events matter. A **permanent bounce** is a mailbox that does not
 * exist; a **complaint** is its owner pressing "spam"; a **contact updated**
 * to `unsubscribed` is somebody leaving from inside a Resend broadcast, which
 * this database would otherwise never hear about. Everything else — sent,
 * delivered, opened, clicked — is acknowledged and dropped. Nothing here
 * changes a preference: the suppression list is a separate fact from what
 * the person chose, and `sendNotificationEmail` reads both.
 *
 * Verified with the SDK's `webhooks.verify`, which is the Standard Webhooks
 * HMAC over `id.timestamp.body` — so the body has to be read raw. Fastify's
 * JSON parser would have consumed it, hence the string parser scoped to this
 * plugin. Without `RESEND_WEBHOOK_SECRET` the route answers that it is not
 * configured, which is what makes the dashboard's test button say so plainly
 * rather than 200 on an unverified payload.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const resendWebhookRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
    done(null, body)
  })

  app.post(
    '/webhooks/resend',
    { config: { rateLimit: { max: 600, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const secret = app.env.RESEND_WEBHOOK_SECRET
      if (!secret) {
        throw new ApiError(ERROR_CODES.INTERNAL, 'Resend webhooks are not configured')
      }

      const header = (name: string): string => {
        const value = request.headers[name]
        return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
      }

      let event: ReturnType<Resend['webhooks']['verify']>
      try {
        // The client is only a namespace for `verify`; no request is made, so
        // the key it insists on can be anything when none is configured.
        event = new Resend(app.env.RESEND_API_KEY ?? 're_webhook_verify_only').webhooks.verify({
          payload: typeof request.body === 'string' ? request.body : JSON.stringify(request.body),
          headers: {
            id: header('svix-id'),
            timestamp: header('svix-timestamp'),
            signature: header('svix-signature'),
          },
          webhookSecret: secret,
        })
      } catch {
        throw new ApiError(ERROR_CODES.UNAUTHENTICATED, 'Invalid webhook signature')
      }

      const suppressed = await applyEvent(app.mongo.db, event)
      if (suppressed.length > 0) {
        request.log.info({ event: event.type, count: suppressed.length }, 'addresses suppressed')
      }
      return reply.send({ received: true, suppressed: suppressed.length })
    },
  )
}

type WebhookEvent = ReturnType<Resend['webhooks']['verify']>

/**
 * Which addresses an event takes off the list, and why. Exported for the
 * test that feeds it each shape, since the signature check above is the
 * only other thing in the route.
 */
export function suppressionsFor(
  event: WebhookEvent,
): { email: string; reason: SuppressionReason }[] {
  switch (event.type) {
    case 'email.bounced': {
      // A transient bounce — full mailbox, greylisting — is not a dead
      // address, and suppressing it would lose real people over a bad day.
      if (event.data.bounce.type.toLowerCase() !== 'permanent') return []
      return event.data.to.map((email) => ({ email, reason: 'bounced' as const }))
    }
    case 'email.complained':
      return event.data.to.map((email) => ({ email, reason: 'complained' as const }))
    case 'contact.updated':
      return event.data.unsubscribed ? [{ email: event.data.email, reason: 'unsubscribed' }] : []
    default:
      return []
  }
}

async function applyEvent(
  db: Parameters<typeof suppressEmail>[0],
  event: WebhookEvent,
): Promise<string[]> {
  const rows = suppressionsFor(event)
  for (const row of rows) await suppressEmail(db, row)
  return rows.map((row) => row.email)
}
