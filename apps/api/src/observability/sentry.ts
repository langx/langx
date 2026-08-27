import * as Sentry from '@sentry/node'
import type { FastifyInstance } from 'fastify'
import type { Env } from '../env'

/**
 * Error reporting, off unless `SENTRY_DSN` is set — the same rule as every
 * other optional service here (storage, translation, email, push): the app
 * boots and works fully without it.
 *
 * Initialised before `buildApp` so anything thrown during startup — a failed
 * index creation, a bad Mongo URI — is reported too. An error reporter that
 * only starts once the app is healthy misses exactly the errors worth knowing.
 */
export function initSentry(env: Env): boolean {
  if (!env.SENTRY_DSN) return false

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    // Sampled, not exhaustive: a trace on every request would cost more than
    // the signal is worth for an app this size.
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 0,
    // The single most dangerous default in an app whose entire content is
    // private conversations. Never send PII, never send request bodies.
    sendDefaultPii: false,
    beforeSend(event) {
      // Belt and braces: message bodies and session cookies must not leave
      // here even if some future integration starts attaching them.
      if (event.request) {
        delete event.request.data
        delete event.request.cookies
        if (event.request.headers) {
          delete event.request.headers.cookie
          delete event.request.headers.authorization
        }
      }
      return event
    },
  })
  return true
}

/**
 * Reports unhandled 5xx responses. Deliberately not 4xx: a refused quota, a
 * blocked user, a taken handle are all the system working as designed, and
 * paging on them trains everyone to ignore the alerts.
 */
export function attachSentryErrorHandler(app: FastifyInstance): void {
  app.addHook('onError', (request, _reply, error, done) => {
    const status = (error as { statusCode?: number }).statusCode ?? 500
    if (status >= 500) {
      Sentry.captureException(error, {
        tags: { route: request.routeOptions.url ?? request.url, method: request.method },
        // The user id, never the email or anything they wrote.
        ...(request.userId ? { user: { id: request.userId } } : {}),
      })
    }
    done()
  })
}

export { Sentry }
