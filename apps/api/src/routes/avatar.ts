import { avatarOptionsFor, GENERATED_AVATAR_BACKGROUNDS, OFFICIAL_HANDLES } from '@langx/shared'
import { createAvatar } from '@dicebear/core'
import { notionists } from '@dicebear/collection'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { loadAsset } from '../lib/assets'
import { getProfileGender } from '../modules/profiles/profiles'

/**
 * Copilot's face, in code rather than in `assets/`, because it is twenty lines
 * of SVG and a binary in the repository is a file nobody can review in a diff.
 * The app icon is a real picture and lives on disk; this is a glyph.
 */
const COPILOT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" role="img" aria-label="Copilot"><rect width="128" height="128" rx="28" fill="#3b6cf6"/><path d="M64 26l8.4 22.6a12 12 0 0 0 7 7L102 64l-22.6 8.4a12 12 0 0 0-7 7L64 102l-8.4-22.6a12 12 0 0 0-7-7L26 64l22.6-8.4a12 12 0 0 0 7-7z" fill="#ffffff"/></svg>`

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

  /**
   * The face of an account LangX speaks from.
   *
   * Served rather than uploaded, so a fresh database — a self-host, a test, a
   * developer's laptop — has the right picture without anybody seeding one,
   * and so the account is never left holding a link into storage that this
   * deployment does not have.
   *
   * A static segment ahead of `:seed`, whose 24-hex bound would refuse the
   * word anyway. Unauthenticated and unbounded by rate limit for the same
   * reason as the generated faces: it is a picture, and both files are
   * constants — nothing here reads the database at all.
   */
  app.get(
    '/public/avatar/official/:handle',
    { schema: { params: z.object({ handle: z.enum(OFFICIAL_HANDLES) }) } },
    async (request, reply) => {
      const { handle } = request.params
      const cached = reply
        .header('cache-control', `public, max-age=${CACHE_SECONDS}`)
        .headers(EMBEDDABLE)

      if (handle === 'copilot') {
        return cached.header('content-type', 'image/svg+xml').send(COPILOT_SVG)
      }
      /*
       * @langx wears the app icon: the assistant is the product speaking, and
       * a second mark for it would be a second brand to keep in step.
       *
       * Its own 512px copy rather than `icon.png`, which is 64px and shared
       * with the insight page — right there, and soft on a profile that draws
       * an avatar at 96pt on a retina screen. Two files because the two sizes
       * are for two different jobs, not because the picture differs.
       */
      return cached
        .header('content-type', 'image/png')
        .send(await loadAsset('official-langx.png', 'Official avatar'))
    },
  )

  // Same as the QR plugin: Fastify wants an async plugin, and this one has
  // nothing of its own to await.
  await Promise.resolve()
}
