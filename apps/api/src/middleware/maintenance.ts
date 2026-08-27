import { ERROR_CODES, ERROR_STATUS, type ApiErrorBody } from '@langx/shared'
import type { FastifyInstance } from 'fastify'
import { getAppConfig } from '../modules/appConfig/appConfig'

/**
 * Paths that stay reachable while maintenance is on.
 *
 * `/health` because the platform's health check must not fail — a 503 there
 * would make the deploy target restart the container in a loop. `/app-config`
 * because it is how the client learns *why* it is being refused. Better Auth's
 * routes because an admin has to be able to sign in to verify the fix before
 * reopening; every other route still refuses them, so a signed-in non-admin
 * gains nothing.
 */
const ALWAYS_OPEN = ['/health', '/app-config', '/api/auth/']

function isAlwaysOpen(url: string): boolean {
  const path = url.split('?')[0] ?? ''
  return ALWAYS_OPEN.some((prefix) => path === prefix || path.startsWith(prefix))
}

/**
 * Refuses every request with 503 while maintenance is on.
 *
 * Two switches, and the order matters: the env variable is checked first
 * because it keeps working when the database does not, which is exactly the
 * situation a hard kill switch exists for. The database flag is the everyday
 * one — flipping it is a single write and takes effect within the config
 * cache's TTL, no redeploy.
 *
 * `Retry-After` is set so crawlers and clients back off properly rather than
 * hammering a service that is deliberately down.
 */
export function registerMaintenanceGate(app: FastifyInstance): void {
  const adminIds = new Set(app.env.ADMIN_USER_IDS)

  app.addHook('onRequest', async (request, reply) => {
    if (isAlwaysOpen(request.url)) return

    if (app.env.MAINTENANCE_MODE) {
      return send503(reply, 'LangX is temporarily unavailable for maintenance.')
    }

    const config = await getAppConfig(app.mongo.db)
    if (!config.maintenance.enabled) return

    // Admins pass through, so a fix can be verified against the real system
    // before anyone else is let back in.
    if (adminIds.size > 0) {
      const session = await app.auth.api
        .getSession({ headers: toHeaders(request.headers) })
        .catch(() => null)
      if (session && adminIds.has(session.user.id)) return
    }

    return send503(
      reply,
      config.maintenance.message || 'LangX is temporarily unavailable for maintenance.',
      config.maintenance.until,
    )
  })
}

function toHeaders(raw: Record<string, unknown>): Headers {
  const headers = new Headers()
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string') headers.append(key, value)
    else if (Array.isArray(value)) for (const v of value) headers.append(key, String(v))
  }
  return headers
}

function send503(
  reply: {
    code: (n: number) => typeof reply
    header: (k: string, v: string) => typeof reply
    send: (b: unknown) => unknown
  },
  message: string,
  until: string | null = null,
): unknown {
  const body: ApiErrorBody & { until?: string } = {
    code: ERROR_CODES.MAINTENANCE,
    message,
    ...(until ? { until } : {}),
  }
  const seconds = until
    ? Math.max(60, Math.round((new Date(until).getTime() - Date.now()) / 1000))
    : 300
  return reply.code(ERROR_STATUS.MAINTENANCE).header('retry-after', String(seconds)).send(body)
}
