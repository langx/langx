import { ERROR_CODES, revenueCatWebhookBodySchema } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { ApiError } from '../lib/ApiError'
import { requireAuth } from '../middleware/requireAuth'
import { asFakeRevenueCat } from '../modules/billing/fakeRevenueCat'
import { refreshEntitlement } from '../modules/billing/refresh'
import { processRevenueCatWebhook } from '../modules/billing/webhook'
import { getProfile } from '../modules/profiles/profiles'

/**
 * What the local harness can make the fake store do. Not "every RevenueCat
 * event type": each of these is one a user can actually cause from the app or
 * their store account, and the point of the harness is to reproduce the flow a
 * person goes through. Replaying arbitrary event types is what
 * `scripts/revenuecat-webhook.ts` is for.
 */
const testEventBodySchema = z
  .object({
    action: z.enum(['purchase', 'cancel', 'expire']),
    /** A `PACKAGES` identifier. Required by `purchase`, meaningless to the rest. */
    packageId: z.string().min(1).optional(),
  })
  .refine((body) => body.action !== 'purchase' || body.packageId !== undefined, {
    message: 'packageId is required for a purchase',
    path: ['packageId'],
  })

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

  if (app.env.REVENUECAT_FAKE_STORE) registerTestStoreRoute(app)
}

/**
 * `POST /billing/test-event` — buy, cancel or expire against the fake store.
 *
 * Registered only when `REVENUECAT_FAKE_STORE` is on, which `loadEnv` refuses
 * under `NODE_ENV=production`. See `docs/billing-testing.md`.
 *
 * It deliberately does **not** shortcut to writing `profiles.entitlement`. The
 * fake store produces the event RevenueCat would have sent and this handler
 * puts it through `processRevenueCatWebhook`, the same function the real
 * webhook route calls with the same arguments — so what the harness exercises
 * is the production path, and a bug in it fails here too. What is skipped is
 * only the HTTP hop and its shared-secret check, which have their own tests
 * and their own script.
 */
function registerTestStoreRoute(app: Parameters<FastifyPluginAsyncZod>[0]): void {
  const store = asFakeRevenueCat(app.revenueCat)
  if (!store) {
    // Refusing to boot rather than skipping the route: the flag is set, so
    // somebody is expecting to be able to buy, and a 404 at the paywall is a
    // much harder thing to explain than a message at startup.
    throw new Error(
      'REVENUECAT_FAKE_STORE is set but the RevenueCat client is not the fake one — check createRevenueCatClientFromEnv',
    )
  }

  app.post(
    '/billing/test-event',
    { schema: { body: testEventBodySchema }, preHandler: requireAuth },
    async (request, reply) => {
      const { action, packageId } = request.body
      const userId = request.userId

      // Always the caller's own id, never one from the body. The harness is a
      // development tool, but "grant Pro to any user id you can name" is not a
      // shape worth having anywhere.
      const event =
        action === 'purchase'
          ? store.purchase(userId, packageId ?? '')
          : action === 'cancel'
            ? store.cancel(userId)
            : store.expire(userId)

      if (!event) {
        throw new ApiError(
          ERROR_CODES.VALIDATION_FAILED,
          action === 'purchase'
            ? `No such package: ${packageId ?? ''}`
            : 'Nothing to change — this account has no purchase in the fake store',
        )
      }

      await processRevenueCatWebhook(app.mongo.db, event, store)
      const profile = await getProfile(app.mongo.db, userId)
      return reply.send({
        event: { id: event.id, type: event.type },
        entitlement: profile?.entitlement,
      })
    },
  )
}
