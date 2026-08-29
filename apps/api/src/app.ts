import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import { ERROR_CODES, ERROR_STATUS, type ApiErrorBody } from '@langx/shared'
import Fastify, { type FastifyInstance } from 'fastify'
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod'
import type { Db, MongoClient } from 'mongodb'
import type { Auth } from './auth'
import type { Env } from './env'
import { ApiError } from './lib/ApiError'
import { registerMaintenanceGate } from './middleware/maintenance'
import { accountRoutes } from './routes/account'
import { appConfigRoutes } from './routes/appConfig'
import { loginRoutes } from './routes/login'
import { registerAuthRoutes } from './routes/auth'
import { billingRoutes } from './routes/billing'
import { conversationRoutes } from './routes/conversations'
import { discoveryRoutes } from './routes/discovery'
import { feedRoutes } from './routes/feed'
import { followRoutes } from './routes/follows'
import { likeRoutes } from './routes/likes'
import { handleRoutes } from './routes/handles'
import { healthRoutes } from './routes/health'
import { mediaRoutes } from './routes/media'
import { activityRoutes } from './routes/activity'
import { messageRoutes } from './routes/messages'
import { moderationRoutes } from './routes/moderation'
import { profileRoutes } from './routes/profiles'
import { translationRoutes } from './routes/translate'
import { leaderboardRoutes } from './routes/leaderboard'
import { xpRoutes } from './routes/tokens'
import type { RevenueCatClient } from './modules/billing/revenueCatClient'
import { LoggingPushSender, type PushSender } from './modules/push/devices'
import { DisabledLegacyVerifier, type LegacyVerifier } from './modules/handles/legacyLogin'
import type { StorageProvider } from './storage/StorageProvider'
import type { TranslationProvider } from './translation/TranslationProvider'
import { attachSocketServer } from './ws'
import type { AppServer } from './ws/types'

declare module 'fastify' {
  interface FastifyInstance {
    mongo: { client: MongoClient; db: Db }
    auth: Auth
    env: Env
    storage: StorageProvider
    translation: TranslationProvider
    revenueCat: RevenueCatClient
    push: PushSender
    legacyVerifier: LegacyVerifier
    appVersion: string
    /**
     * The pinned server type, not socket.io's default. Its generics default
     * `data` to `any`, which makes every `app.io` handed to a typed helper an
     * unsafe argument — caught by lint the first time a route outside `ws/`
     * needed to fan a message out.
     */
    io: AppServer
  }
}

export interface BuildAppOptions {
  env: Env
  client: MongoClient
  db: Db
  auth: Auth
  storage: StorageProvider
  translation: TranslationProvider
  revenueCat: RevenueCatClient
  /**
   * Defaults to the logging no-op. Production passes `ExpoPushSender`
   * explicitly from index.ts; leaving it optional keeps every test from having
   * to name a dependency it never exercises.
   */
  push?: PushSender
  /**
   * Checks a v1 password against the still-running Appwrite. Defaults to the
   * disabled one, so tests and any instance without APPWRITE_* simply never
   * take the bridge path.
   */
  legacyVerifier?: LegacyVerifier
  version?: string
}

export async function buildApp({
  env,
  client,
  db,
  auth,
  storage,
  translation,
  revenueCat,
  push = new LoggingPushSender(),
  legacyVerifier = new DisabledLegacyVerifier(),
  version = '2.0.0',
}: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'development'
        ? {
            level: env.LOG_LEVEL,
            transport: {
              target: 'pino-pretty',
              options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
            },
          }
        : { level: env.LOG_LEVEL },
    // Railway/Render terminate TLS upstream; without this the client IP the
    // rate limiter sees is the proxy's, i.e. everyone shares one bucket.
    trustProxy: env.NODE_ENV === 'production',
  })

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  app.decorate('mongo', { client, db })
  app.decorate('auth', auth)
  app.decorate('env', env)
  app.decorate('storage', storage)
  app.decorate('translation', translation)
  app.decorate('revenueCat', revenueCat)
  app.decorate('push', push)
  app.decorate('legacyVerifier', legacyVerifier)
  app.decorate('appVersion', version)

  await app.register(helmet, { contentSecurityPolicy: false })

  await app.register(cors, {
    origin: env.TRUSTED_ORIGINS.length > 0 ? env.TRUSTED_ORIGINS : true,
    // Better Auth uses cookies on web; native sends the session as a header.
    credentials: true,
    /**
     * `@fastify/cors` defaults to `GET,HEAD,POST` — which silently made every
     * `PATCH` and `DELETE` impossible from the web build. Editing a profile
     * and unregistering a push token both failed at the preflight, before the
     * request existed, so the server logged nothing and the client could only
     * report a generic failure.
     *
     * Native was unaffected (no preflight), which is exactly why it went
     * unnoticed: the two platforms disagreed about whether the app worked.
     *
     * `PUT` joined the list for the same reason, one verb later: liking is an
     * idempotent set, the browser refused the preflight, and the heart simply
     * did not fill — no error, no server log, nothing to read. Anything added
     * here has to be added *here* too.
     */
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  await app.register(rateLimit, {
    /**
     * Effectively off under `NODE_ENV=test`, and only there. A suite drives
     * several hundred requests through one synthetic connection in seconds, so
     * the limiter ends up measuring the harness rather than a user — and the
     * symptom is not a failing assertion about rate limiting but whichever
     * test happens to run last failing on a 429, which reads as a bug in the
     * feature it was written for. Adding a test is then a way to break an
     * unrelated one, which is a worse property for a suite to have than
     * leaving this guard unexercised.
     */
    max: env.NODE_ENV === 'test' ? Number.MAX_SAFE_INTEGER : 300,
    timeWindow: '1 minute',
  })

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send(error.toBody())
    }

    if (hasZodFastifySchemaValidationErrors(error)) {
      const body: ApiErrorBody = {
        code: ERROR_CODES.VALIDATION_FAILED,
        message: 'Request failed validation',
        details: error.validation,
      }
      return reply.code(ERROR_STATUS.VALIDATION_FAILED).send(body)
    }

    // Fastify 5 hands the handler an `unknown`; narrow before touching it.
    const status = (error as { statusCode?: number }).statusCode ?? 500
    if (status >= 500) {
      request.log.error({ err: error }, 'unhandled error')
      const body: ApiErrorBody = {
        code: ERROR_CODES.INTERNAL,
        // Never leak internals to the client; the log has the detail.
        message: 'Internal server error',
      }
      return reply.code(500).send(body)
    }

    const body: ApiErrorBody = {
      code: status === 429 ? ERROR_CODES.RATE_LIMITED : ERROR_CODES.FORBIDDEN,
      message: error instanceof Error ? error.message : 'Request failed',
    }
    return reply.code(status).send(body)
  })

  app.setNotFoundHandler((_request, reply) => {
    const body: ApiErrorBody = {
      code: ERROR_CODES.NOT_FOUND,
      message: 'Route not found',
    }
    return reply.code(404).send(body)
  })

  // Before every route, so nothing slips past it.
  registerMaintenanceGate(app)

  await app.register(healthRoutes)
  await app.register(appConfigRoutes)
  await app.register(loginRoutes)
  await registerAuthRoutes(app, auth)
  await app.register(profileRoutes)
  await app.register(followRoutes)
  await app.register(handleRoutes)
  await app.register(mediaRoutes)
  await app.register(discoveryRoutes)
  await app.register(feedRoutes)
  await app.register(likeRoutes)
  await app.register(conversationRoutes)
  await app.register(messageRoutes)
  await app.register(translationRoutes)
  await app.register(billingRoutes)
  await app.register(xpRoutes)
  await app.register(activityRoutes)
  await app.register(leaderboardRoutes)
  await app.register(moderationRoutes)
  await app.register(accountRoutes)

  // Attached last: Socket.io only needs `app.server` (Fastify creates the
  // underlying http.Server synchronously at construction) plus the
  // decorators above (`mongo`, `auth`, `env`), all already in place by now.
  app.decorate('io', attachSocketServer(app))

  return app
}
