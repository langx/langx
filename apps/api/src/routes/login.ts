import { ERROR_CODES, loginSchema, type LoginResult } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { ApiError } from '../lib/ApiError'
import { hasLegacyAccount, padTo } from '../modules/handles/legacyLogin'
import { restoreLegacyProfile } from '../modules/handles/legacyRestore'

/**
 * Sign-in, with a bridge to v1 behind it.
 *
 * The client calls this instead of Better Auth's `/api/auth/sign-in/email`,
 * because a returning v1 user typing the password they have always used has to
 * end up signed in — and their old password cannot be checked here. v1's hashes
 * are one-way and use a different algorithm, so the only system that can still
 * answer is v1 itself, which is still running.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const loginRoutes: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/auth/login',
    {
      schema: { body: loginSchema },
      // Tighter than the global limit. This path can forward a password to
      // another system, so it gets its own ceiling rather than sharing the
      // 300/minute everything else has.
      config: { rateLimit: { max: 10, timeWindow: '5 minutes' } },
    },
    async (request, reply) => {
      const startedAt = Date.now()
      const { email, password } = request.body

      // 1. The normal path. Almost every sign-in ends here.
      const headers = new Headers({ 'content-type': 'application/json' })
      const direct = await app.auth.api
        .signInEmail({ body: { email, password }, headers, asResponse: true })
        .catch(() => null)

      if (direct?.ok) {
        forwardCookies(direct, reply)
        const body: LoginResult = { migratedFromV1: false, restored: null }
        await padTo(startedAt)
        return reply.send(body)
      }

      // 2. Only now, and only for an address we already know was a v1 user, is
      //    the password forwarded anywhere. A new user's password never leaves.
      const isLegacy = await hasLegacyAccount(app.mongo.db, email, app.env.LEGACY_EMAIL_HASH_SALT)
      if (!isLegacy || !(await app.legacyVerifier.verify(email, password))) {
        await padTo(startedAt)
        throw new ApiError(ERROR_CODES.UNAUTHENTICATED, 'Invalid email or password')
      }

      // 3. v1 says the password is right. Create the v2 account with the same
      //    password, mark it verified — the address is proven, v1 required
      //    verification too — and let the `user.create.after` hook restore the
      //    profile. Same code path as Google/Apple, not a parallel one.
      const created = await app.auth.api
        .signUpEmail({
          body: { email, password, name: email.split('@')[0] ?? 'LangX' },
          headers,
          asResponse: true,
        })
        .catch(() => null)

      if (!created?.ok) {
        // The account exists in v2 but the password differs — they changed it
        // here and typed the old one. Not a bridge case.
        await padTo(startedAt)
        throw new ApiError(ERROR_CODES.UNAUTHENTICATED, 'Invalid email or password')
      }

      const userId = await markVerified(app, email)
      const restored = userId
        ? await restoreLegacyProfile(app.mongo.db, userId, email, app.env.LEGACY_EMAIL_HASH_SALT)
        : null

      // Sign in properly now that the account is verified, so the caller gets
      // the same session cookie any other sign-in would produce.
      const session = await app.auth.api
        .signInEmail({ body: { email, password }, headers, asResponse: true })
        .catch(() => null)
      if (!session?.ok) {
        await padTo(startedAt)
        throw new ApiError(ERROR_CODES.INTERNAL, 'Could not complete sign-in')
      }
      forwardCookies(session, reply)

      const body: LoginResult = {
        migratedFromV1: true,
        restored:
          restored?.kind === 'restored'
            ? {
                handle: restored.handle,
                tokensCredited: restored.tokensCredited,
                frozenStreak: restored.frozenStreak,
              }
            : null,
      }
      await padTo(startedAt)
      return reply.send(body)
    },
  )
}

/**
 * The bridge has already proven the address — v1 required a verified email to
 * sign in at all — so making the user click a link to prove it again would be
 * asking them to confirm something we just confirmed.
 *
 * This writes to a Better Auth collection directly, which the rest of the
 * codebase deliberately never does. It is the one exception, and it is here
 * because Better Auth exposes no server-side "this address is already proven"
 * call.
 */
async function markVerified(
  app: Parameters<FastifyPluginAsyncZod>[0],
  email: string,
): Promise<string | null> {
  const users = app.mongo.db.collection<{ _id: unknown; email: string; emailVerified: boolean }>(
    'user',
  )
  const result = await users.findOneAndUpdate(
    { email },
    { $set: { emailVerified: true } },
    { returnDocument: 'after' },
  )
  return result ? String(result._id) : null
}

/** Better Auth sets the session cookie on its own Response; pass it through ours. */
function forwardCookies(
  response: Response,
  reply: { header: (k: string, v: string) => unknown },
): void {
  for (const cookie of response.headers.getSetCookie()) {
    reply.header('set-cookie', cookie)
  }
}
