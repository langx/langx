import { ERROR_CODES } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { Resend } from 'resend'
import { z } from 'zod'
import { ApiError } from '../lib/ApiError'
import { getLeaderboard } from '../modules/tokens/leaderboard'

/** token.langx.io shows ten rows and nothing else. */
const PUBLIC_BOARD_SIZE = 10
/** A public table that changes at most once a day; a minute of caching is plenty. */
const BOARD_CACHE_SECONDS = 60

/**
 * The two things v1's Express API served to callers outside the app, moved
 * here so `api.langx.io` can point at this process without either going dark.
 *
 * Both are unauthenticated by nature: a marketing site cannot hold a session,
 * and a public leaderboard is public. Each is rate-limited on its own, because
 * the global limiter is sized for a signed-in client, not for a form on a
 * page anybody can load.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- Fastify plugin signature
export const publicRoutes: FastifyPluginAsyncZod = async (app) => {
  /**
   * The newsletter form on langx.io. v1 put the address on a SendGrid list;
   * this puts it on a Resend audience, which is the provider every other
   * email here already goes through. The response shape is v1's — `status:
   * 'ok'` — because the form that reads it is deployed separately and must
   * keep working across the cutover.
   *
   * Consent is explicit: the person typed their address into a box labelled
   * newsletter. This is not the promotions switch on a profile, which is a
   * different consent recorded in a different place.
   */
  app.post(
    '/public/newsletter',
    {
      schema: { body: z.object({ email: z.string().trim().email().max(254) }) },
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { RESEND_API_KEY, RESEND_AUDIENCE_ID } = app.env
      // Degrades like storage and translation do: an instance without the
      // audience answers with a clear failure, never with a silent "ok" that
      // subscribed nobody. The form shows its generic error either way.
      if (!RESEND_API_KEY || !RESEND_AUDIENCE_ID) {
        request.log.warn('newsletter subscribe refused: RESEND_AUDIENCE_ID is not set')
        throw new ApiError(ERROR_CODES.INTERNAL, 'Newsletter is not configured')
      }
      const resend = new Resend(RESEND_API_KEY)
      const { error } = await resend.contacts.create({
        audienceId: RESEND_AUDIENCE_ID,
        email: request.body.email,
        unsubscribed: false,
      })
      // An address that is already on the list is a success from the reader's
      // side — they asked to be subscribed and they are. Anything else is not.
      if (error && !/already exists/i.test(error.message)) {
        request.log.warn({ err: error }, 'newsletter subscribe failed')
        throw new ApiError(ERROR_CODES.INTERNAL, 'Could not subscribe')
      }
      return reply.send({ status: 'ok' })
    },
  )

  /**
   * The all-time token leaderboard, top ten, for token.langx.io.
   *
   * The signed-in board takes a viewer — for blocks, and for "your rank" —
   * and this one has none. An empty viewer id reaches nothing in either
   * lookup: no block row names it and no aggregate is keyed by it, so the
   * viewer-shaped fields come back empty and are simply not sent.
   */
  app.get(
    '/public/leaderboard/token',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (_request, reply) => {
      const board = await getLeaderboard(app.mongo.db, '', {
        period: 'all',
        limit: PUBLIC_BOARD_SIZE,
      })
      return reply.header('cache-control', `public, max-age=${BOARD_CACHE_SECONDS}`).send({
        period: board.period,
        entries: board.entries.map(({ rank, handle, displayName, tokens }) => ({
          rank,
          handle,
          displayName,
          tokens,
        })),
      })
    },
  )
}
