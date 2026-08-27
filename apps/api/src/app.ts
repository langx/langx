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
import type { Server as SocketIOServer } from 'socket.io'
import type { Auth } from './auth'
import type { Env } from './env'
import { ApiError } from './lib/ApiError'
import { accountRoutes } from './routes/account'
import { registerAuthRoutes } from './routes/auth'
import { billingRoutes } from './routes/billing'
import { conversationRoutes } from './routes/conversations'
import { discoveryRoutes } from './routes/discovery'
import { handleRoutes } from './routes/handles'
import { healthRoutes } from './routes/health'
import { mediaRoutes } from './routes/media'
import { messageRoutes } from './routes/messages'
import { moderationRoutes } from './routes/moderation'
import { profileRoutes } from './routes/profiles'
import { translationRoutes } from './routes/translate'
import { leaderboardRoutes } from './routes/leaderboard'
import { xpRoutes } from './routes/xp'
import type { RevenueCatClient } from './modules/billing/revenueCatClient'
import { LoggingPushSender, type PushSender } from './modules/push/devices'
import type { StorageProvider } from './storage/StorageProvider'
import type { TranslationProvider } from './translation/TranslationProvider'
import { attachSocketServer } from './ws'

declare module 'fastify' {
  interface FastifyInstance {
    mongo: { client: MongoClient; db: Db }
    auth: Auth
    env: Env
    storage: StorageProvider
    translation: TranslationProvider
    revenueCat: RevenueCatClient
    push: PushSender
    appVersion: string
    io: SocketIOServer
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
  app.decorate('appVersion', version)

  await app.register(helmet, { contentSecurityPolicy: false })

  await app.register(cors, {
    origin: env.TRUSTED_ORIGINS.length > 0 ? env.TRUSTED_ORIGINS : true,
    // Better Auth uses cookies on web; native sends the session as a header.
    credentials: true,
  })

  await app.register(rateLimit, {
    max: 300,
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

  await app.register(healthRoutes)
  await registerAuthRoutes(app, auth)
  await app.register(profileRoutes)
  await app.register(handleRoutes)
  await app.register(mediaRoutes)
  await app.register(discoveryRoutes)
  await app.register(conversationRoutes)
  await app.register(messageRoutes)
  await app.register(translationRoutes)
  await app.register(billingRoutes)
  await app.register(xpRoutes)
  await app.register(leaderboardRoutes)
  await app.register(moderationRoutes)
  await app.register(accountRoutes)

  // Attached last: Socket.io only needs `app.server` (Fastify creates the
  // underlying http.Server synchronously at construction) plus the
  // decorators above (`mongo`, `auth`, `env`), all already in place by now.
  app.decorate('io', attachSocketServer(app))

  return app
}
