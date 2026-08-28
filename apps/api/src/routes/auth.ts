import type { FastifyInstance } from 'fastify'
import type { Auth } from '../auth'

/**
 * Bridges Fastify to Better Auth's handler, which speaks the Web Fetch API
 * (`(request: Request) => Promise<Response>`), not Fastify's request/reply.
 *
 * Registered in its own encapsulated sub-plugin so the wildcard content-type
 * parser below applies only to `/api/auth/*` — every other route keeps
 * Fastify's normal JSON body parsing untouched. Without that scoping this
 * would break every other route in the app.
 */
export async function registerAuthRoutes(app: FastifyInstance, auth: Auth): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
  await app.register(async (scope) => {
    // Hand Better Auth the exact bytes it received — including
    // application/x-www-form-urlencoded, which Apple's native OAuth callback
    // uses — instead of letting Fastify parse (and thereby consume) the body
    // before auth.handler ever sees it. Fastify's built-in application/json
    // parser takes priority over a wildcard one added on top of it, so the
    // defaults have to go first — scoped to this sub-plugin only, every other
    // route keeps normal JSON parsing.
    scope.removeAllContentTypeParsers()
    scope.addContentTypeParser('*', { parseAs: 'buffer' }, (_request, payload, done) => {
      done(null, payload)
    })

    scope.all('/api/auth/*', async (request, reply) => {
      const url = new URL(request.url, auth.options.baseURL)

      const headers = new Headers()
      for (const [key, value] of Object.entries(request.headers)) {
        if (typeof value === 'string') headers.append(key, value)
        else if (Array.isArray(value)) for (const v of value) headers.append(key, v)
      }

      // Only a request that actually carried bytes gets a body: Better Auth
      // answers 415 to an empty body with no content-type, which is exactly
      // what a bodyless POST like sign-out would become otherwise.
      // `request.body` is a Buffer only when the parser above ran on real
      // bytes — it is null for an empty payload.
      const raw = request.body
      const hasBody = request.method !== 'GET' && request.method !== 'HEAD' && Buffer.isBuffer(raw)
      // A `Buffer` is not a `BodyInit`: `BufferSource` here is the DOM's (a
      // dependency pulls lib.dom in), and since TS 5.7 that accepts only a
      // view over a non-shared `ArrayBuffer`, while `Buffer.buffer` is
      // `ArrayBufferLike`. Copying is the honest fix — auth bodies are a few
      // hundred bytes, and the alternative is a cast that lies about which
      // buffer backs the view.
      const webRequest = new Request(
        url,
        hasBody
          ? { method: request.method, headers, body: new Uint8Array(raw) }
          : { method: request.method, headers },
      )

      const response = await auth.handler(webRequest)

      reply.status(response.status)
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() === 'set-cookie') return
        reply.header(key, value)
      })
      const setCookies = response.headers.getSetCookie?.() ?? []
      if (setCookies.length > 0) reply.header('set-cookie', setCookies)

      reply.send(response.body ? Buffer.from(await response.arrayBuffer()) : null)
    })
  })
}
