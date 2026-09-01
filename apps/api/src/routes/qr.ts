import { handleSchema, INVITE_QUERY_PARAM, inviteUrl, profileUrl, WEB_HOST } from '@langx/shared'
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import QRCode from 'qrcode'
import { z } from 'zod'

/**
 * One day. The image is a pure function of the handle and the invite marker, so a cache that outlives
 * a deploy is not a staleness risk — only a rename would change it, and a
 * rename changes the URL too.
 */
const CACHE_SECONDS = 86_400

/**
 * A profile's link as a QR code, rendered server-side.
 *
 * Generated here rather than in the app on purpose. Drawing one on the client
 * means `react-native-qrcode-svg`, which needs `react-native-svg` — a **native
 * module**, so a new binary and no OTA update, for a picture. `_layout.tsx`
 * already rejected that dependency once, for icons.
 *
 * Server-side it is a plain `<Image>` on every platform including web, it is
 * cacheable at the edge, and it costs the app nothing.
 *
 * SVG rather than PNG: it is smaller than the equivalent bitmap, scales to
 * whatever size the screen asks for, and `expo-image` renders it everywhere.
 *
 * Unauthenticated, like the shared profile it points at — a QR of a public
 * link is not more secret than the link. It does **not** check that the handle
 * exists: doing so would turn this into a way to enumerate accounts by asking
 * for pictures, and a code that resolves to a 404 page is a harmless thing to
 * have drawn.
 */
/**
 * These are the only responses meant to be embedded by another origin.
 *
 * Helmet sets `Cross-Origin-Resource-Policy: same-origin` for everything,
 * which is right for an API and wrong for a picture: the web build lives on
 * `app2.langx.io` and the image on `api2.langx.io`, so the browser blocked it
 * outright — `ERR_BLOCKED_BY_RESPONSE.NotSameOrigin`, with no request logged
 * server-side and nothing on screen.
 *
 * Relaxed per route rather than globally. CORP is what stops another site
 * reading responses it should not, and every other endpoint here answers with
 * somebody's data; these two answer with a QR of a public link.
 *
 * `image/svg+xml` is safe in an `<img>` — scripts inside an SVG do not execute
 * in that context — and `nosniff` stays on.
 */
const EMBEDDABLE = { 'cross-origin-resource-policy': 'cross-origin' } as const

export const qrRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/public/qr/:handle',
    {
      schema: {
        params: z.object({ handle: handleSchema }),
        /*
         * The one thing that changes what is drawn: the same handle and the
         * same public link, plus the marker that makes a scan attributable.
         * Still not a `?to=<anything>` renderer — the URL is built here from a
         * handle, so this can only ever point at a profile on our own host.
         */
        querystring: z.object({ [INVITE_QUERY_PARAM]: z.literal('1').optional() }),
      },
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const target = request.query[INVITE_QUERY_PARAM]
        ? inviteUrl(request.params.handle)
        : profileUrl(request.params.handle)
      const svg = await QRCode.toString(target, {
        type: 'svg',
        // `M` recovers ~15% of the image. Enough for a screen somebody is
        // pointing a camera at, and it keeps the grid coarse enough to scan
        // from a phone held at arm's length.
        errorCorrectionLevel: 'M',
        // The quiet zone is part of the spec, not decoration: without it a
        // reader has nothing to lock the edges against.
        margin: 2,
      })
      return reply
        .header('content-type', 'image/svg+xml')
        .header('cache-control', `public, max-age=${CACHE_SECONDS}`)
        .headers(EMBEDDABLE)
        .send(svg)
    },
  )

  /*
   * The device-flow verification link, as a code.
   *
   * Takes the **user code**, not a URL. A `?to=<anything>` endpoint would be a
   * QR generator on our own domain that encodes whatever an attacker asks for
   * — a phishing primitive wearing our hostname. Building the URL here means
   * the only thing this can ever point at is our own `/link-device` page.
   */
  app.get(
    '/public/qr/link/:code',
    {
      schema: { params: z.object({ code: z.string().trim().min(4).max(32) }) },
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      // `user_code`, because that is the name Better Auth puts in its own
      // `verification_uri_complete` — a QR that used a different one would
      // send people to the same page with the field left empty.
      const target = `https://${WEB_HOST}/link-device?user_code=${encodeURIComponent(
        request.params.code,
      )}`
      const svg = await QRCode.toString(target, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 2,
      })
      return (
        reply
          .header('content-type', 'image/svg+xml')
          // A device code lives two minutes; caching its picture past that would
          // only ever serve something already dead.
          .header('cache-control', 'no-store')
          .headers(EMBEDDABLE)
          .send(svg)
      )
    },
  )

  await Promise.resolve()
}
