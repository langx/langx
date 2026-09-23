import { z } from 'zod'

/**
 * One address found in a message, by where it sits in the text.
 *
 * `href` is what opening it goes to; `start`/`end` cut the original string, so
 * the bubble can draw the text around it untouched. The two differ for an
 * address written without a scheme, which is opened over https.
 */
export interface FoundLink {
  start: number
  end: number
  href: string
}

/** An address with a scheme or a `www.` in front: never in doubt. */
const LINK = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi

/**
 * A bare `langx.io` or `hürriyet.com.tr/spor` — a host of dotted labels, then
 * an optional path.
 *
 * Not preceded by a letter, a digit, `@`, `.`, `/` or `-`, so the domain half
 * of an email address and the middle of a longer address are never matched on
 * their own.
 */
const BARE =
  /(?<![\p{L}\p{N}@._/-])((?:[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?\.)+(\p{L}{2,24}))(?![\p{L}\p{N}-])(\/[^\s<>"]*)?/gu

/**
 * Endings that make a bare host a link on their own.
 *
 * A language-learning chat is full of "e.g." and `file.txt`, and a missed
 * space after a full stop — "ok.no", "come.in" — writes something shaped like
 * a domain in every one of the eight languages. So the ending decides: the
 * ones below are links by themselves, and any other ending is a link only
 * with a path after it (`youtu.be/…`, `t.me/…`), which no typo produces.
 * Deliberately absent: endings that are also common words — `in`, `it`, `at`,
 * `be`, `is`, `no`, `to`, `so`, `me`, `us`, `do`, `go`, `my`, `on`, `or`.
 */
const LINK_ENDINGS = new Set([
  // generic
  'com',
  'net',
  'org',
  'info',
  'biz',
  'edu',
  'gov',
  'mil',
  'int',
  'io',
  'co',
  'app',
  'dev',
  'ai',
  'gg',
  'tv',
  'ly',
  'fm',
  'xyz',
  'site',
  'online',
  'store',
  'shop',
  'blog',
  'news',
  'tech',
  'page',
  'link',
  'club',
  'live',
  // countries — the ones people learning these languages actually link to
  'tr',
  'de',
  'fr',
  'es',
  'ru',
  'uk',
  'ca',
  'jp',
  'cn',
  'kr',
  'br',
  'mx',
  'ar',
  'au',
  'nl',
  'pl',
  'se',
  'ch',
  'pt',
  'gr',
  'cz',
  'ua',
  'eu',
  'ir',
  'sa',
  'ae',
  'eg',
  'tw',
  'hk',
  'vn',
  'id',
  'th',
  'nz',
  'ie',
  'dk',
  'fi',
  'hu',
  'ro',
  'cl',
  'pe',
  'za',
])

/**
 * What a sentence usually ends a link with that is not part of it.
 *
 * `)` is on the list but handled apart: Wikipedia's addresses carry balanced
 * parentheses, and a link wrapped in them — "(see https://…)" — does not.
 */
const TRAILING = /[.,!?;:'"»”’…]+$/

/** Peels punctuation and unbalanced closing brackets until neither applies. */
function trimTail(raw: string): string {
  for (;;) {
    const stripped = raw.replace(TRAILING, '')
    if (stripped !== raw) {
      raw = stripped
      continue
    }
    const last = raw.at(-1)
    const pair = last === ')' ? '(' : last === ']' ? '[' : null
    if (last && pair && count(raw, last) > count(raw, pair)) {
      raw = raw.slice(0, -1)
      continue
    }
    return raw
  }
}

export function findLinks(text: string): FoundLink[] {
  const found: FoundLink[] = []
  for (const match of text.matchAll(LINK)) {
    const raw = trimTail(match[0])
    // "www." alone, or a scheme with nothing after it, is a word, not a link.
    if (/^(?:https?:\/\/|www\.)$/i.test(raw)) continue
    const href = /^www\./i.test(raw) ? `https://${raw}` : raw
    if (!isHttpUrl(href)) continue
    found.push({ start: match.index, end: match.index + raw.length, href })
  }
  for (const match of text.matchAll(BARE)) {
    const start = match.index
    // Inside an address the first pass already took — `www.langx.io` is both.
    if (found.some((link) => start < link.end && start >= link.start)) continue
    const ending = (match[2] ?? '').toLowerCase()
    const path = match[3] ? trimTail(match[3]) : ''
    if (!LINK_ENDINGS.has(ending) && (path.length < 2 || !/^[a-z]+$/.test(ending))) continue
    const raw = (match[1] ?? '') + path
    found.push({ start, end: start + raw.length, href: `https://${raw}` })
  }
  return found.sort((a, b) => a.start - b.start)
}

function count(text: string, char: string): number {
  let n = 0
  for (const c of text) if (c === char) n++
  return n
}

/**
 * A regular expression, not `new URL`: this package is typed without the DOM
 * or Node libraries, so `URL` does not exist for it. Loose on purpose — the
 * server parses the address properly before it fetches anything.
 */
const HOST = /^https?:\/\/(?:[^@/?#\s]+@)?([^/?#:\s]+)/i

function isHttpUrl(value: string): boolean {
  const host = HOST.exec(value)?.[1]
  return host !== undefined && /\.[^.]/.test(host)
}

/** The one address a preview is asked for. Length-capped: nothing real is longer. */
export const linkPreviewQuerySchema = z.object({
  url: z.string().min(1).max(2048),
})

/**
 * What the card under a link shows.
 *
 * Every field is what the page said about itself, trimmed; `image` is never
 * the page's own address for its picture but a copy in our bucket, so opening
 * a chat does not tell a stranger's server who is reading it.
 */
export interface LinkPreview {
  url: string
  siteName: string
  title: string
  description: string | null
  image: string | null
}

/** `null` means the page had nothing worth drawing, or could not be read. */
export interface LinkPreviewResponse {
  preview: LinkPreview | null
}
