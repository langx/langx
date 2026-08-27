import {
  APP_PLATFORM_HEADER,
  APP_VERSION_HEADER,
  isUpdateRequired,
  type AppConfigResponse,
} from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { getAppConfig } from '../modules/appConfig/appConfig'

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const appConfigRoutes: FastifyPluginAsyncZod = async (app) => {
  /**
   * Unauthenticated on purpose, and exempt from the maintenance gate: this is
   * how a client finds out *why* everything else is refusing it. Requiring a
   * session would mean a signed-out user sees a generic failure instead of the
   * maintenance message.
   */
  app.get('/app-config', { config: { rateLimit: false } }, async (request, reply) => {
    const config = await getAppConfig(app.mongo.db)

    const version = request.headers[APP_VERSION_HEADER] as string | undefined
    const platform = (request.headers[APP_PLATFORM_HEADER] as string | undefined) ?? 'web'
    const minimum =
      platform === 'ios'
        ? config.minVersion.ios
        : platform === 'android'
          ? config.minVersion.android
          : config.minVersion.web

    const body: AppConfigResponse = {
      ...config,
      updateRequired: isUpdateRequired(version, minimum),
    }
    // Short cache: long enough to absorb a launch stampede, short enough that
    // turning maintenance on is not stuck behind a CDN.
    return reply.header('cache-control', 'public, max-age=10').send(body)
  })
}
