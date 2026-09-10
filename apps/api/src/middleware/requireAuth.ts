import { ERROR_CODES, ERROR_STATUS, type ApiErrorBody } from '@langx/shared'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { COLLECTIONS } from '../db/collections'
import { isSuspended } from '../modules/moderation/suspension'
import type { Profile } from '../modules/profiles/profiles'

/**
 * The two routes a suspended account may still reach: reading its own
 * suspension, and appealing it once. Everything else is refused.
 *
 * Sign-out is not here because it does not need to be — Better Auth's own
 * `/api/auth/*` routes never run this guard.
 */
const SUSPENSION_ALLOWED_PATHS = new Set(['/me/suspension', '/me/suspension/appeal'])

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by requireAuth. Never read `req.userId` on a route that doesn't use this preHandler. */
    userId: string
    userEmail: string
    emailVerified: boolean
    /** Set by requireAuth. A guest browsing without an account of their own. */
    isGuest: boolean
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
  // `isAnonymous` is declared by the plugin with `input: false`, so a client
  // cannot assert it — it is only ever true because Better Auth made the user.
  request.isGuest = (session.user as { isAnonymous?: boolean }).isAnonymous === true

  /*
   * Suspension is enforced here rather than route by route, because "every
   * route except two" is a rule that cannot survive being repeated: the next
   * route added would be the one that forgot.
   *
   * The cost is one projected `_id` read per authenticated request, next to
   * the two the session lookup already makes. The cheaper-looking alternative
   * — putting the flag on Better Auth's `user` document, which the session
   * already loads — would mean declaring `additionalFields` on their
   * collection and keeping our moderation state inside it. Two id worlds and
   * somebody else's schema is a worse trade than a point read.
   *
   * A guest has no profile, so `findOne` answers null and they pass.
   */
  if (SUSPENSION_ALLOWED_PATHS.has(request.routeOptions.url ?? request.url)) return

  const profile = await request.server.mongo.db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOne({ _id: request.userId }, { projection: { suspension: 1 } })
  const suspension = profile?.suspension
  if (suspension && isSuspended(profile)) {
    const body: ApiErrorBody = {
      code: ERROR_CODES.ACCOUNT_SUSPENDED,
      message: 'This account is suspended',
      // Sent with the refusal so the screen can say when it ends without a
      // second request the same guard would have to let through.
      until: suspension.permanent ? null : new Date(suspension.until).toISOString(),
      permanent: suspension.permanent,
    }
    return reply.code(ERROR_STATUS.ACCOUNT_SUSPENDED).send(body)
  }
}

/**
 * Layer on top of `requireAuth` for anything a guest must not do.
 *
 * Guests are `emailVerified: false`, so every route behind
 * `requireVerifiedEmail` is closed to them for free — a happy accident, and the
 * strongest single argument for using Better Auth's anonymous plugin rather
 * than inventing a session. That guard now answers them with this same code
 * rather than an email error they can do nothing about. This covers the rest:
 * the writes that only ever needed `requireAuth`, which is most of them.
 *
 * A distinct code rather than `UNAUTHENTICATED`, because the client's answer is
 * different. Unauthenticated means "sign in"; this means "you are browsing as a
 * guest, and this needs an account" — which is an offer, not an error.
 */
export async function requireMember(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(request, reply)
  if (reply.sent) return

  if (request.isGuest) {
    const body: ApiErrorBody = {
      code: ERROR_CODES.GUEST_ACCOUNT,
      message: 'Create an account to do that',
    }
    return reply.code(ERROR_STATUS.GUEST_ACCOUNT).send(body)
  }
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

  /*
   * A guest is answered as a guest, before the email check that would also
   * have stopped them.
   *
   * Both refusals close the route, so this changes nothing about who gets in.
   * What it changes is what the client can do next: `EMAIL_NOT_VERIFIED` says
   * "verify your email", and a guest has no email to verify — the screen has
   * nowhere to send them, so it falls through to a generic failure toast. It
   * was found that way, on `Follow`, which is behind this guard rather than
   * `requireMember` and so never produced the code the transport watches for.
   *
   * Ordering it before the email check is what makes `requireMember`
   * unnecessary on a route that already requires verification.
   */
  if (request.isGuest) {
    const body: ApiErrorBody = {
      code: ERROR_CODES.GUEST_ACCOUNT,
      message: 'Create an account to do that',
    }
    return reply.code(ERROR_STATUS.GUEST_ACCOUNT).send(body)
  }

  if (!request.emailVerified) {
    const body: ApiErrorBody = {
      code: ERROR_CODES.EMAIL_NOT_VERIFIED,
      message: 'Verify your email first',
    }
    return reply.code(ERROR_STATUS.EMAIL_NOT_VERIFIED).send(body)
  }
}
