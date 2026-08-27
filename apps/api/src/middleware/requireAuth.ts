import { ERROR_CODES, ERROR_STATUS, type ApiErrorBody } from '@langx/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by requireAuth. Never read `req.userId` on a route that doesn't use this preHandler. */
    userId: string
    userEmail: string
    emailVerified: boolean
  }
}

/**
 * The one way any of *our* routes learn who's calling. Better Auth's own
 * `/api/auth/*` routes (routes/auth.ts) validate the session themselves —
 * this is for everything else, built the same way that bridge builds a Web
 * Request: convert Fastify's headers, hand them to `auth.api.getSession`.
 *
 * `preHandler`, not a global hook — routes opt in explicitly (`/health` and
 * `/api/auth/*` must stay reachable unauthenticated).
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const headers = new Headers()
  for (const [key, value] of Object.entries(request.headers)) {
    if (typeof value === 'string') headers.append(key, value)
    else if (Array.isArray(value)) for (const v of value) headers.append(key, v)
  }

  const session = await request.server.auth.api.getSession({ headers })

  if (!session) {
    const body: ApiErrorBody = { code: ERROR_CODES.UNAUTHENTICATED, message: 'Sign in required' }
    return reply.code(ERROR_STATUS.UNAUTHENTICATED).send(body)
  }

  request.userId = session.user.id
  request.userEmail = session.user.email
  request.emailVerified = session.user.emailVerified
}

/**
 * Layer on top of requireAuth for routes that need a verified email (all of
 * Faz 2's domain writes do — an unverified account has no business claiming
 * a handle or existing in discovery). Better Auth already blocks *sign-in*
 * pre-verification; this covers the same account reaching an endpoint
 * through some other still-valid session path.
 */
export async function requireVerifiedEmail(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await requireAuth(request, reply)
  if (reply.sent) return

  if (!request.emailVerified) {
    const body: ApiErrorBody = {
      code: ERROR_CODES.EMAIL_NOT_VERIFIED,
      message: 'Verify your email first',
    }
    return reply.code(ERROR_STATUS.EMAIL_NOT_VERIFIED).send(body)
  }
}
