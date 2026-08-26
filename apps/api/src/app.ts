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
import type { Env } from './env'
import { healthRoutes } from './routes/health'

declare module 'fastify' {
  interface FastifyInstance {
    mongo: { client: MongoClient; db: Db }
    appVersion: string
  }
}

export interface BuildAppOptions {
  env: Env
  client: MongoClient
  db: Db
  version?: string
}

export async function buildApp({
  env,
  client,
  db,
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

  return app
}
