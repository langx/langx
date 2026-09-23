import { createHash } from 'node:crypto'
import type { LinkPreview } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { sniffImageType } from '../../lib/sniffImageType'
import { supportsPut, type StorageProvider } from '../../storage/StorageProvider'
import { objectExtension } from '../media/objectExtension'
import { parseMeta } from './parseMeta'
import { isFetchableUrl, type SafeGet } from './safeFetch'

export interface LinkPreviewDoc {
  url: string
  preview: LinkPreview | null
  createdAt: Date
  expiresAt: Date
}

/**
 * A week for a page that answered, a day for one that did not. A title
 * changes rarely and a stale one is harmless; a page that was down, or
 * refused a bot, deserves another try but not one per reader.
 */
const FOUND_TTL_MS = 7 * 24 * 60 * 60 * 1000
const MISSING_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Enough for the `<head>` of the heaviest page people actually share. Most
 * fit in a few kilobytes; YouTube's watch page inlines about 700 KB of script
 * before its first `og:` tag, and a 512 KB cap drew no card for it.
 */
const PAGE_MAX_BYTES = 1024 * 1024
const IMAGE_MAX_BYTES = 3 * 1024 * 1024

export interface LinkPreviewDeps {
  fetch: SafeGet
  storage: StorageProvider
}

/**
 * The address a cache row is kept under: the fragment dropped, because
 * `#section` never changes what the server sends back.
 */
export function normaliseLinkUrl(raw: string): URL | null {
  try {
    const url = new URL(raw.trim())
    url.hash = ''
    return isFetchableUrl(url) ? url : null
  } catch {
    return null
  }
}

/**
 * The card for a link — from the cache when anybody has asked before, from
 * the page itself when nobody has.
 *
 * Not charged against any quota: it costs one outbound request per address
 * per week however many people open it, and the route is rate limited.
 */
export async function getLinkPreview(
  db: Db,
  deps: LinkPreviewDeps,
  raw: string,
): Promise<LinkPreview | null> {
  const url = normaliseLinkUrl(raw)
  if (!url) return null
  const key = url.toString()

  const cache = db.collection<LinkPreviewDoc>(COLLECTIONS.linkPreviews)
  const hit = await cache.findOne({ url: key })
  // The TTL monitor runs about once a minute; the date is the real rule.
  if (hit && hit.expiresAt > new Date()) return hit.preview

  const preview = await readPreview(deps, url)
  const now = new Date()
  await cache.updateOne(
    { url: key },
    {
      $set: {
        preview,
        createdAt: now,
        expiresAt: new Date(now.getTime() + (preview ? FOUND_TTL_MS : MISSING_TTL_MS)),
      },
    },
    { upsert: true },
  )
  return preview
}

async function readPreview(deps: LinkPreviewDeps, url: URL): Promise<LinkPreview | null> {
  const page = await deps.fetch(url.toString(), {
    accept: ['text/html', 'application/xhtml+xml'],
    maxBytes: PAGE_MAX_BYTES,
    truncate: true,
  })
  if (!page) return null

  const meta = parseMeta(decodeBody(page.body, page.contentType), page.url)
  // A page with neither a title nor a description has nothing to put on a
  // card; the link itself already says where it goes.
  if (!meta.title && !meta.description) return null

  const image = meta.image ? await copyImage(deps, meta.image).catch(() => null) : null
  const host = page.url.hostname.replace(/^www\./, '')
  return {
    // The address that was sent, not where it redirected to: the card belongs
    // to the link in the message, and a tap opens that.
    url: url.toString(),
    siteName: meta.siteName ?? host,
    title: meta.title ?? host,
    description: meta.description,
    image,
  }
}

/**
 * The page's picture, copied into our bucket.
 *
 * Handing the reader the page's own image address would have every phone
 * that opens the chat fetch it from a stranger's server — a read receipt for
 * whoever runs that server, and a hot-link many of them refuse anyway. The
 * copy is named by its bytes, so a picture shared by a thousand pages is one
 * object and the CDN's year-long cache can never serve the wrong one.
 *
 * No storage configured means no picture; the card still draws.
 */
async function copyImage(deps: LinkPreviewDeps, address: string): Promise<string | null> {
  if (!supportsPut(deps.storage)) return null
  const image = await deps.fetch(address, {
    accept: ['image/'],
    maxBytes: IMAGE_MAX_BYTES,
    truncate: false,
  })
  if (!image) return null
  // What the bytes are, not what the header claims — the header is the
  // stranger's word, and the bucket serves whatever type it is told.
  const type = sniffImageType(image.body)
  if (!type) return null
  const hash = createHash('sha256').update(image.body).digest('hex')
  return deps.storage.putObject(
    `link-previews/${hash}.${objectExtension(type)}`,
    new Uint8Array(image.body),
    type,
  )
}

/**
 * Bytes to text in the page's own encoding — the header's, else the one the
 * page declares in a `<meta>`, else UTF-8. A label TextDecoder does not know
 * falls back to UTF-8 rather than failing the card.
 */
export function decodeBody(body: Buffer, contentType: string): string {
  const declared =
    /charset=["']?([\w-]+)/i.exec(contentType)?.[1] ??
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(body.subarray(0, 2048).toString('latin1'))?.[1] ??
    'utf-8'
  try {
    return new TextDecoder(declared).decode(body)
  } catch {
    return new TextDecoder('utf-8').decode(body)
  }
}
