import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'

/**
 * Apple's proof that whoever configured the Services ID also controls the
 * domain its return URL sits on.
 *
 * Sign in with Apple on the web and on Android goes through the Services ID,
 * and Apple will not save a return URL — so the two platforms that cannot use
 * the native sheet cannot sign in at all — until it has fetched this file from
 * that URL's own host. The rules are Apple's and they are literal: exactly
 * this path, `text/plain`, HTTPS, 200, and **no redirect**, which is why this
 * is a route on the API rather than a file next to the app's `assetlinks.json`
 * on the web host.
 *
 * Registered only when the token is configured, so an install that has never
 * set one answers 404 here rather than serving an empty file that fails
 * verification with no explanation — the same shape as every other optional
 * service in this API.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const wellKnownRoutes: FastifyPluginAsyncZod = async (app) => {
  const association = app.env.APPLE_DOMAIN_ASSOCIATION
  if (!association) return

  app.get(
    '/.well-known/apple-developer-domain-association.txt',
    // Apple fetches this from its own infrastructure, with no session and no
    // way to be told to come back later.
    { config: { rateLimit: false } },
    (_request, reply) => reply.type('text/plain; charset=utf-8').send(association),
  )
}
