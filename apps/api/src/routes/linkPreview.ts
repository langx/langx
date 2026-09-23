import { linkPreviewQuerySchema, type LinkPreviewResponse } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { requireAuth } from '../middleware/requireAuth'
import { getLinkPreview } from '../modules/linkPreview/linkPreview'

// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const linkPreviewRoutes: FastifyPluginAsyncZod = async (app) => {
  /**
   * The card under a link in a chat.
   *
   * A GET with the address in the query, so the phone can cache it like any
   * other read.
   *
   * `requireAuth`, not `requireMember`: a guest can be looking at a thread
   * with a link in it, and the client answers `GUEST_ACCOUNT` by opening the
   * sign-up screen — from a card loading in the background, that would be a
   * page change nobody asked for. Limited well under the global rate instead:
   * every miss makes this process fetch a stranger's page, and scrolling a
   * long thread is a handful of links, not sixty.
   */
  app.get(
    '/link-preview',
    {
      preHandler: requireAuth,
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: { querystring: linkPreviewQuerySchema },
    },
    async (request, reply) => {
      const preview = await getLinkPreview(
        app.mongo.db,
        { fetch: app.linkFetch, storage: app.storage },
        request.query.url,
      )
      const body: LinkPreviewResponse = { preview }
      return reply.send(body)
    },
  )
}
