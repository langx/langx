import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { requireAuth } from '../middleware/requireAuth'
import { searchCities } from '../modules/cities/cities'

/** Enough to choose from, short enough that the list is not a second problem. */
const MAX_RESULTS = 12

/**
 * The city picker behind the discovery filter.
 *
 * The list is not shipped to the client: about twenty-four thousand places is
 * not something to put in a bundle that is also a web page. It is also the
 * same list the server derives a profile's city from, so the two ends of the
 * filter cannot drift.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const cityRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/cities',
    {
      // Behind auth like everything else here: it is a picker inside the app,
      // not a public gazetteer.
      preHandler: requireAuth,
      schema: { querystring: z.object({ q: z.string().trim().min(1).max(64) }) },
    },
    async (request, reply) => {
      const items = await searchCities(app.mongo.db, request.query.q, MAX_RESULTS)
      return reply.send({ items })
    },
  )
}
