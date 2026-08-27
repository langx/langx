import { ERROR_CODES, revenueCatWebhookBodySchema } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { ApiError } from '../lib/ApiError'
import { requireAuth } from '../middleware/requireAuth'
import { refreshEntitlement } from '../modules/billing/refresh'
import { processRevenueCatWebhook } from '../modules/billing/webhook'

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const billingRoutes: FastifyPluginAsyncZod = async (app) => {
  // Not `requireAuth` — this is RevenueCat calling us, not a user session.
  // RevenueCat doesn't sign webhooks cryptographically; the shared secret in
  // the `Authorization` header, set the same way in the RevenueCat dashboard
  // and here, is the actual defense (see env.ts's doc comment).
  app.post(
    '/webhooks/revenuecat',
    { schema: { body: revenueCatWebhookBodySchema } },
    async (request, reply) => {
      if (!app.env.REVENUECAT_WEBHOOK_AUTH_HEADER) {
        throw new ApiError(ERROR_CODES.INTERNAL, 'Billing is not configured')
      }
      if (request.headers.authorization !== app.env.REVENUECAT_WEBHOOK_AUTH_HEADER) {
        throw new ApiError(ERROR_CODES.UNAUTHENTICATED, 'Invalid webhook credentials')
      }

      const result = await processRevenueCatWebhook(
        app.mongo.db,
        request.body.event,
        app.revenueCat,
      )
      return reply.send(result)
    },
  )

  app.post('/billing/refresh', { preHandler: requireAuth }, async (request, reply) => {
    const entitlement = await refreshEntitlement(app.mongo.db, app.revenueCat, request.userId)
    return reply.send(entitlement)
  })
}
