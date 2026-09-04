/**
 * `app.langx.io/s/<id>` — the page a share card is shared as.
 *
 * The card itself lives in the media bucket, and that URL is deliberately not
 * what leaves the app: a raw image link unfurls as a bare picture with no
 * title, and gives whoever taps it nowhere to go. This page owns the
 * OpenGraph tags, shows the card, offers the download, and points at the app.
 *
 * A Pages Function rather than a route in the Expo app because the Expo web
 * build is a static export — every route ships the same empty shell and fills
 * it in on the client, so a crawler fetching one sees no title and no image.
 * Meta tags have to exist in the bytes the crawler is handed, which means
 * something has to run at the edge.
 *
 * Everything interpolated here is escaped: `headline`, `caption` and `handle`
 * are user-authored, and the id comes off the URL.
 */

interface Env {
  /** Overridable so a preview deployment can point at a staging API. */
  API_BASE_URL?: string
}

interface PublicShareCard {
  id: string
  kind: string
  shape: string
  imageUrl: string
  headline: string
  caption: string
  handle: string
}

const DEFAULT_API = 'https://api.langx.io'

/** The four characters that can escape an HTML attribute or a text node. */
function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/** 9:16, 1:1 and 16:9 — the three the API renders. */
const SQUARE = { width: 1080, height: 1080 }
const DIMENSIONS: Record<string, { width: number; height: number } | undefined> = {
  story: { width: 1080, height: 1920 },
  square: SQUARE,
  wide: { width: 1200, height: 675 },
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const id = context.params.id
  if (typeof id !== 'string') return new Response('Not found', { status: 404 })

  const api = context.env.API_BASE_URL ?? DEFAULT_API
  const response = await fetch(`${api}/public/share/${encodeURIComponent(id)}`, {
    // The card never changes once written, so the edge may hold it — and this
    // is the request a viral story would make a few thousand times.
    cf: { cacheTtl: 3600, cacheEverything: true },
  })
  if (!response.ok) return new Response('Not found', { status: 404 })

  // Workers types `json()` as a generic, so this is a parse with a shape
  // rather than a cast over one.
  const card = await response.json<PublicShareCard>()
  // A shape this page does not know about is drawn as a square rather than
  // as a 404: the picture is already rendered and the tags still work.
  const size = DIMENSIONS[card.shape] ?? SQUARE
  const title = `${card.headline} · ${card.caption}`
  const canonical = `https://app.langx.io/s/${encodeURIComponent(card.id)}`

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} — LangX</title>
<link rel="canonical" href="${escapeHtml(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="LangX">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(card.handle)} on LangX — a language exchange.">
<meta property="og:url" content="${escapeHtml(canonical)}">
<meta property="og:image" content="${escapeHtml(card.imageUrl)}">
<meta property="og:image:width" content="${size.width}">
<meta property="og:image:height" content="${size.height}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:image" content="${escapeHtml(card.imageUrl)}">
<style>
  :root { color-scheme: light dark; }
  body {
    align-items: center; background: #fafafa; color: #17191c;
    display: flex; flex-direction: column; gap: 20px; justify-content: center;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    margin: 0; min-height: 100vh; padding: 24px;
  }
  img { border-radius: 16px; box-shadow: 0 8px 30px rgba(0,0,0,.12); max-height: 70vh; max-width: 100%; }
  .actions { display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; }
  a { border-radius: 999px; font-weight: 700; padding: 12px 22px; text-decoration: none; }
  .primary { background: #ffc409; color: #201900; }
  .secondary { border: 1px solid #e8eaec; color: #17191c; }
  @media (prefers-color-scheme: dark) {
    body { background: #17191c; color: #fefefe; }
    .secondary { border-color: #2c2f34; color: #fefefe; }
  }
</style>
</head>
<body>
  <img src="${escapeHtml(card.imageUrl)}" width="${size.width}" height="${size.height}"
       alt="${escapeHtml(title)}">
  <div class="actions">
    <!--
      \`download\` works here and not in the app: this is an ordinary browser
      page, so the file saves without expo-media-library and without a new
      native build.
    -->
    <a class="primary" href="${escapeHtml(card.imageUrl)}" download>Download</a>
    <a class="secondary" href="https://app.langx.io/">Open LangX</a>
  </div>
</body>
</html>`

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=600',
    },
  })
}
