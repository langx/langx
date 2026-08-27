import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'

const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  uptimeSeconds: z.number(),
  version: z.string(),
  db: z.enum(['up', 'down']),
})

/**
 * Liveness *and* readiness in one endpoint: the platform health check needs to
 * pull an instance out of rotation when Atlas is unreachable, not just when the
 * process is dead. A degraded database answers 503 for that reason.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/health',
    {
      config: { rateLimit: false },
      schema: {
        response: {
          200: healthResponseSchema,
          503: healthResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      let db: 'up' | 'down' = 'down'
      try {
        await app.mongo.db.command({ ping: 1 })
        db = 'up'
      } catch (error) {
        app.log.error({ err: error }, 'health check: database ping failed')
      }

      const body = {
        status: db === 'up' ? ('ok' as const) : ('degraded' as const),
        uptimeSeconds: Math.round(process.uptime()),
        version: app.appVersion,
        db,
      }

      return reply.code(db === 'up' ? 200 : 503).send(body)
    },
  )
}
