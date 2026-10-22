import {
  COPILOT_RULES,
  copilotCheckRequestSchema,
  copilotConsentRequestSchema,
  copilotExplainRequestSchema,
  copilotReplyIdeasRequestSchema,
  copilotReportRequestSchema,
  copilotSayItRequestSchema,
} from '@langx/shared'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { localeFromHeader } from '../i18n'
import { rateLimitKey } from '../lib/clientIp'
import { requireVerifiedEmail } from '../middleware/requireAuth'
import { getAppConfig } from '../modules/appConfig/appConfig'
import { askCopilot, getCopilotStatus, type CopilotDeps } from '../modules/copilot/copilot'
import { recordCopilotConsent, withdrawCopilotConsent } from '../modules/copilot/consent'
import { reportCopilotAnswer } from '../modules/copilot/report'

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
 * Each ask route's own ceiling, per account: `COPILOT_RULES.askRoutePerHour`.
 * Counted at `preHandler`, after `requireVerifiedEmail` has set `userId`, so
 * the key is the person rather than their network — the default hook runs
 * before anyone is known. Keyed on the user, it is also safe under test: a
 * suite's fixtures sign in as different people, so none spends another's.
 */
const askRateLimit = {
  max: COPILOT_RULES.askRoutePerHour,
  timeWindow: '1 hour',
  hook: 'preHandler' as const,
  keyGenerator: (request: FastifyRequest) =>
    request.userId ? `user:${request.userId}` : rateLimitKey(request),
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

  /*
   * Reporting an answer: a row in the operators' feedback queue. Its own
   * ceiling, off under test for the reason `feedback.ts` gives — a suite's
   * one connection would spend it on fixtures.
   */
  app.post(
    '/copilot/report',
    {
      preHandler: requireVerifiedEmail,
      schema: { body: copilotReportRequestSchema },
      config: {
        rateLimit: app.env.NODE_ENV === 'test' ? false : { max: 20, timeWindow: '1 hour' },
      },
    },
    async (request, reply) => {
      await reportCopilotAnswer(app.mongo.db, request.userId, request.body)
      return reply.code(202).send({ ok: true })
    },
  )

  app.post(
    '/copilot/check',
    {
      preHandler: requireVerifiedEmail,
      schema: { body: copilotCheckRequestSchema },
      config: { rateLimit: askRateLimit },
    },
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
    {
      preHandler: requireVerifiedEmail,
      schema: { body: copilotReplyIdeasRequestSchema },
      config: { rateLimit: askRateLimit },
    },
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
    '/copilot/say-it',
    {
      preHandler: requireVerifiedEmail,
      schema: { body: copilotSayItRequestSchema },
      config: { rateLimit: askRateLimit },
    },
    async (request, reply) => {
      const result = await askCopilot(
        await depsFor(app),
        request.userId,
        localeFromHeader(request.headers['accept-language']),
        { action: 'sayIt', ...request.body },
      )
      return reply.send(result)
    },
  )

  app.post(
    '/copilot/explain',
    {
      preHandler: requireVerifiedEmail,
      schema: { body: copilotExplainRequestSchema },
      config: { rateLimit: askRateLimit },
    },
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
