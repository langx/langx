import { avatarOptionsFor, GENERATED_AVATAR_BACKGROUNDS } from '@langx/shared'
import { createAvatar } from '@dicebear/core'
import { notionists } from '@dicebear/collection'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { getProfileGender } from '../modules/profiles/profiles'

/**
 * A week. The picture is no longer a pure function of the URL — it also reads
 * the account's gender — so this cannot be `immutable`. Gender is writable
 * exactly once, from `undisclosed` to a value, so a week is the longest a
 * stale face can survive, and the alternative (a cache-busting parameter)
 * would have to carry the very field this route exists to keep off the wire.
 */
const CACHE_SECONDS = 604_800

/** Same reason as the QR route: an API is same-origin, a picture is not. */
const EMBEDDABLE = { 'cross-origin-resource-policy': 'cross-origin' } as const

/**
 * A face for an account that has not uploaded a photo.
 *
 * Two initials on one of three fills is what a photoless account used to look
 * like, which in a discovery list is a column of coloured squares with letters
 * on them. A drawn face is recognisable, and being deterministic it is the
 * *same* face on every screen and every device until a photo replaces it.
 *
 * **Rendered here, not in the app.** The established pattern is the QR route:
 * drawing SVG on the client means `react-native-svg`, a native module — a new
 * binary for a picture, and nothing that needs one can ship over the air.
 *
 * **Ours, not DiceBear's hosted API and not Gravatar.** Both put a third party
 * between the device and a picture of our users, Gravatar additionally on a
 * hash of their email, and the store listing promises exactly one third-party
 * SDK. The library is MIT and runs here.
 *
 * **Gender is read from the account, never taken from the caller.** Most of
 * the DTOs that feed an avatar — a feed author, a chat partner, a leaderboard
 * row — carry no gender at all, so a `?g=` parameter would give the same
 * person a beard on one screen and none on the next. One projected read keeps
 * every screen identical.
 *
 * Unauthenticated, like the QR. The beard discloses nothing new: `male` and
 * `female` are already in the discovery DTO, and the two private answers
 * render from the untouched default pool, so an account that kept the field to
 * itself looks exactly like one that was never asked.
 */
export const avatarRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/public/avatar/:seed',
    {
      schema: {
        /*
         * A profile id, and nothing else. Without the bound this is a free SVG
         * generator that will draw a face for any string anybody posts.
         */
        params: z.object({ seed: z.string().regex(/^[a-f0-9]{24}$/) }),
      },
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { seed } = request.params
      /*
       * An id nobody holds gets a face too, 200 rather than 404. With a lookup
       * behind it, answering "not found" would make this a way to ask whether
       * an account exists, one id at a time.
       */
      const gender = await getProfileGender(app.mongo.db, seed)

      const svg = createAvatar(notionists, {
        seed,
        size: 128,
        backgroundColor: [...GENERATED_AVATAR_BACKGROUNDS],
        ...avatarOptionsFor(gender),
      }).toString()

      return reply
        .header('content-type', 'image/svg+xml')
        .header('cache-control', `public, max-age=${CACHE_SECONDS}`)
        .headers(EMBEDDABLE)
        .send(svg)
    },
  )

  // Same as the QR plugin: Fastify wants an async plugin, and this one has
  // nothing of its own to await.
  await Promise.resolve()
}
