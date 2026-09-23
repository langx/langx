/**
 * What a page says about itself, read out of its `<head>`.
 *
 * Regular expressions over the markup rather than a parser: the only things
 * wanted are `<meta>` tags and one `<title>`, which have been written the same
 * way for twenty years, and a DOM library for four fields would be the largest
 * dependency on the API. A page too broken for this is a page whose card is
 * not drawn — which is the same outcome a parser would reach more slowly.
 *
 * Every pattern here is linear in the page, and that is the part to keep when
 * editing: the page is a stranger's, up to a megabyte, and parsed on the
 * API's one thread. `[^>]*` is not enough — on a page of `<meta <meta <meta`
 * each start scans to the end, and a single 200 KB tag held the process for
 * 48 seconds when measured. `[^<>]*` stops at the next tag instead.
 */
export interface PageMeta {
  title: string | null
  description: string | null
  siteName: string | null
  /** Absolute, http(s) only. */
  image: string | null
}

const LIMITS = { title: 200, description: 300, siteName: 80 }
const MAX_TAG_LENGTH = 4096

export function parseMeta(html: string, base: URL): PageMeta {
  const headEnd = html.search(/<\/head\s*>/i)
  const head = headEnd === -1 ? html : html.slice(0, headEnd)

  const tags = new Map<string, string>()
  for (const [tag] of head.matchAll(/<meta\b[^<>]*>/gi)) {
    // No real meta tag is this long, and the attribute scan below is only
    // cheap on short input.
    if (tag.length > MAX_TAG_LENGTH) continue
    const attrs = attributes(tag)
    const key = (attrs.get('property') ?? attrs.get('name') ?? attrs.get('itemprop'))?.toLowerCase()
    const content = attrs.get('content')
    // First one wins: a page that repeats `og:image` lists its best first.
    if (key && content !== undefined && !tags.has(key)) tags.set(key, content)
  }
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = tags.get(key)
      if (value?.trim()) return value
    }
    return null
  }

  const titleTag = titleOf(head)
  return {
    title: clean(pick('og:title', 'twitter:title') ?? titleTag, LIMITS.title),
    description: clean(
      pick('og:description', 'twitter:description', 'description'),
      LIMITS.description,
    ),
    siteName: clean(pick('og:site_name', 'application-name'), LIMITS.siteName),
    image: absolute(
      pick('og:image:secure_url', 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src'),
      base,
    ),
  }
}

/**
 * The first `<title>`'s text, found with two forward searches rather than one
 * lazy `([\s\S]*?)`, which rescans the rest of the page from every `<title`
 * that has no closing tag.
 */
function titleOf(head: string): string | null {
  const open = /<title\b[^<>]*>/i.exec(head)
  if (!open) return null
  const from = open.index + open[0].length
  const close = /<\/title\s*>/gi
  close.lastIndex = from
  const end = close.exec(head)
  return end ? head.slice(from, end.index) : null
}

/**
 * Name, then an optional value. Every match consumes its whole name, so a
 * long run of letters is read once rather than once per starting position.
 */
function attributes(tag: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const match of tag.matchAll(
    /([^\s=<>"'/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>]+)))?/g,
  )) {
    const name = match[1]
    if (name) out.set(name.toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '')
  }
  return out
}

function clean(value: string | null, max: number): string | null {
  if (value === null) return null
  const text = decodeEntities(value).replace(/\s+/g, ' ').trim()
  if (!text) return null
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

function absolute(value: string | null, base: URL): string | null {
  if (!value) return null
  try {
    const url = new URL(decodeEntities(value).trim(), base)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  laquo: '«',
  raquo: '»',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
}

/**
 * The entities titles actually use. An unknown name is left as written, which
 * reads as a typo in someone else's page rather than as a hole in ours.
 */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body.startsWith('#')) {
      const code =
        body[1] === 'x' || body[1] === 'X'
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10)
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : whole
    }
    return NAMED[body.toLowerCase()] ?? whole
  })
}
