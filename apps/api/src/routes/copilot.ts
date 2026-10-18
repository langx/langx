import {
  copilotCheckRequestSchema,
  copilotConsentRequestSchema,
  copilotExplainRequestSchema,
  copilotReplyIdeasRequestSchema,
} from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { localeFromHeader } from '../i18n'
import { requireVerifiedEmail } from '../middleware/requireAuth'
import { getAppConfig } from '../modules/appConfig/appConfig'
import { askCopilot, getCopilotStatus, type CopilotDeps } from '../modules/copilot/copilot'
import { recordCopilotConsent, withdrawCopilotConsent } from '../modules/copilot/consent'

/**
 * Read per request, never at boot: the operator's switch is a database write
 * (`scripts/maintenance.ts flag copilotEnabled true`), and it has to take
 * effect — on and off — without a deploy. The read is the config's own
 * ten-second memory, so it costs nothing.
 */
async function depsFor(app: FastifyInstance): Promise<CopilotDeps> {
  const config = await getAppConfig(app.mongo.db)
  return {
    db: app.mongo.db,
    provider: app.copilot,
    enabled: config.flags.copilotEnabled,
    log: app.log,
  }
}

/**
 * Copilot. REST only — there is no socket event for it, so there is no second
 * door to guard.
 *
 * Every route is behind `requireVerifiedEmail`, which also answers a guest
 * with `GUEST_ACCOUNT`: a guest has no Copilot, no consent to record and no
 * allowance to spend.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const copilotRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get('/copilot', { preHandler: requireVerifiedEmail }, async (request, reply) => {
    return reply.send(await getCopilotStatus(await depsFor(app), request.userId))
  })

  app.post(
    '/copilot/consent',
    { preHandler: requireVerifiedEmail, schema: { body: copilotConsentRequestSchema } },
    async (request, reply) => {
      await recordCopilotConsent(app.mongo.db, request.userId, request.body.version)
      return reply.code(204).send()
    },
  )

  app.delete('/copilot/consent', { preHandler: requireVerifiedEmail }, async (request, reply) => {
    await withdrawCopilotConsent(app.mongo.db, request.userId)
    return reply.code(204).send()
  })

  app.post(
    '/copilot/check',
    { preHandler: requireVerifiedEmail, schema: { body: copilotCheckRequestSchema } },
    async (request, reply) => {
      const result = await askCopilot(
        await depsFor(app),
        request.userId,
        localeFromHeader(request.headers['accept-language']),
        { action: 'check', ...request.body },
      )
      return reply.send(result)
    },
  )

  app.post(
    '/copilot/reply-ideas',
    { preHandler: requireVerifiedEmail, schema: { body: copilotReplyIdeasRequestSchema } },
    async (request, reply) => {
      const result = await askCopilot(
        await depsFor(app),
        request.userId,
        localeFromHeader(request.headers['accept-language']),
        { action: 'replyIdeas', ...request.body },
      )
      return reply.send(result)
    },
  )

  app.post(
    '/copilot/explain',
    { preHandler: requireVerifiedEmail, schema: { body: copilotExplainRequestSchema } },
    async (request, reply) => {
      const result = await askCopilot(
        await depsFor(app),
        request.userId,
        localeFromHeader(request.headers['accept-language']),
        { action: 'explain', ...request.body },
      )
      return reply.send(result)
    },
  )
}
