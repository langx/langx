import cors, { type FastifyCorsOptions } from '@fastify/cors'
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
import { emailRoutes } from './routes/email'
import { appConfigRoutes } from './routes/appConfig'
import { registerAuthRoutes } from './routes/auth'
import { billingRoutes } from './routes/billing'
import { cityRoutes } from './routes/cities'
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
import { avatarRoutes } from './routes/avatar'
import { qrRoutes } from './routes/qr'
import { publicRoutes } from './routes/public'
import { shareCardRoutes } from './routes/shareCards'
import { translationRoutes } from './routes/translate'
import { leaderboardRoutes } from './routes/leaderboard'
import { referralRoutes } from './routes/referrals'
import { xpRoutes } from './routes/tokens'
import { wellKnownRoutes } from './routes/wellKnown'
import type { RevenueCatClient } from './modules/billing/revenueCatClient'
import { LoggingPushSender, type PushSender } from './modules/push/devices'
import { ConsoleEmailSender, type EmailSender } from './email/sender'
import type { StorageProvider } from './storage/StorageProvider'
import {
  createAttachmentNormalizer,
  type AttachmentNormalizer,
} from './modules/media/transcodeAudio'
import type { TranslationProvider } from './translation/TranslationProvider'
import { attachSocketServer } from './ws'
import type { AppServer } from './ws/types'

declare module 'fastify' {
  interface FastifyInstance {
    mongo: { client: MongoClient; db: Db }
    auth: Auth
    env: Env
    storage: StorageProvider
    /**
     * The attachments as they should be stored, which is only ever different
     * for a voice note recorded in a browser — see `media/transcodeAudio`.
     * Decorated rather than built per call so the ffmpeg path and the logger
     * are settled once, and so a test can hand the insert paths their own.
     */
    normalizeAttachments: AttachmentNormalizer
    translation: TranslationProvider
    revenueCat: RevenueCatClient
    push: PushSender
    /**
     * The same sender Better Auth was handed, so that one array in a test
     * holds both the verification mail and the notification mail — they are
     * one outbox from the reader's side, and were two from ours.
     */
    email: EmailSender
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
   * Defaults to the console sender for the same reason `push` defaults to the
   * logging one: a test that never sends mail should not have to name it.
   */
  email?: EmailSender
  version?: string
}

/**
 * `/public/*` is the API's contract with pages it does not serve: no session,
 * readable from any origin. The same prefix `routes/public.ts` and the shared
 * profile card already use, so a route is public by its name and nothing else.
 */
function isPublicPath(url: string): boolean {
  return (url.split('?')[0] ?? '').startsWith('/public/')
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
  email = new ConsoleEmailSender(console),
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
  app.decorate(
    'normalizeAttachments',
    createAttachmentNormalizer(storage, env.FFMPEG_PATH, (err, message) =>
      app.log.warn({ err }, message),
    ),
  )
  app.decorate('translation', translation)
  app.decorate('revenueCat', revenueCat)
  app.decorate('push', push)
  app.decorate('email', email)
  app.decorate('appVersion', version)

  await app.register(helmet, { contentSecurityPolicy: false })

  /**
   * Two CORS policies, and the path decides which one answers.
   *
   * Everything under `/public/` exists for pages on other origins — the
   * newsletter form on langx.io, the high-score board on token.langx.io — and
   * none of it carries a session. A browser discards a cross-origin response
   * unread unless `Access-Control-Allow-Origin` names the page, and the first
   * deploy of those routes sent no such header: curl saw a 200 while both
   * pages saw a CORS error. Wildcarded here rather than adding the two sites
   * to `TRUSTED_ORIGINS`, because that list also feeds Better Auth's
   * `trustedOrigins`, and a marketing page has no business being trusted with
   * a session. Everything else keeps the credentialed policy.
   *
   * A delegator rather than per-route `config.cors`, because the preflight
   * never reaches the route: `@fastify/cors` answers `OPTIONS` from its own
   * wildcard route, whose config is empty. The path is the one thing the
   * preflight and the real request have in common.
   */
  const publicCors: FastifyCorsOptions = {
    origin: '*',
    credentials: false,
    methods: ['GET', 'HEAD', 'POST', 'OPTIONS'],
  }
  const trustedCors: FastifyCorsOptions = {
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
  }
  await app.register(cors, {
    delegator: (request, callback) => {
      callback(null, isPublicPath(request.url) ? publicCors : trustedCors)
    },
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
  await app.register(wellKnownRoutes)
  await app.register(appConfigRoutes)
  await registerAuthRoutes(app, auth)
  await app.register(profileRoutes)
  await app.register(qrRoutes)
  await app.register(avatarRoutes)
  await app.register(publicRoutes)
  await app.register(shareCardRoutes)
  await app.register(followRoutes)
  await app.register(handleRoutes)
  await app.register(mediaRoutes)
  await app.register(cityRoutes)
  await app.register(discoveryRoutes)
  await app.register(feedRoutes)
  await app.register(likeRoutes)
  await app.register(conversationRoutes)
  await app.register(messageRoutes)
  await app.register(translationRoutes)
  await app.register(billingRoutes)
  await app.register(xpRoutes)
  await app.register(referralRoutes)
  await app.register(activityRoutes)
  await app.register(leaderboardRoutes)
  await app.register(moderationRoutes)
  await app.register(accountRoutes)
  await app.register(emailRoutes)

  // Attached last: Socket.io only needs `app.server` (Fastify creates the
  // underlying http.Server synchronously at construction) plus the
  // decorators above (`mongo`, `auth`, `env`), all already in place by now.
  app.decorate('io', attachSocketServer(app))

  return app
}
