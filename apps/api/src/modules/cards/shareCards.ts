import { inviteUrl } from '@langx/shared'
import { randomUUID } from 'node:crypto'
import QRCode from 'qrcode'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ERROR_CODES } from '@langx/shared'
import { ApiError } from '../../lib/ApiError'
import { supportsPut, type StorageProvider } from '../../storage/StorageProvider'
import type { CardKind, CardShape } from '@langx/shared'
import { cardElement, type CardCopy } from './design'
import { renderCard } from './render'

export interface ShareCard {
  /** Short and URL-safe: it is the whole of `app.langx.io/s/<id>`. */
  _id: string
  userId: string
  kind: CardKind
  shape: CardShape
  /** Where the PNG lives in our own bucket. */
  imageUrl: string
  /** Redrawn on the page, so it does not have to be read out of the picture. */
  headline: string
  caption: string
  handle: string
  createdAt: Date
}

/** What the app is handed back, and what it shares. */
export interface ShareCardResult {
  id: string
  imageUrl: string
  /** `app.langx.io/s/<id>` — the page, never the raw bucket URL. */
  shareUrl: string
}

/**
 * Renders one card, stores the PNG, and files the row the share page reads.
 *
 * **The link that gets shared is the page, not the picture.** A raw
 * `media.langx.io` URL previews as a bare image in every app that unfurls it,
 * carries no title, and gives whoever taps it nowhere to go — so the card is
 * addressed by a page that owns the OpenGraph tags and offers the download.
 * The bucket URL never leaves this module except inside that page.
 *
 * Degrades rather than crashes, per the rule in CLAUDE.md: with no storage
 * configured this refuses with a clear code and the app falls back to sharing
 * the sentence and the link it always did.
 */
export async function createShareCard(
  db: Db,
  storage: StorageProvider,
  input: {
    userId: string
    kind: CardKind
    shape: CardShape
    copy: CardCopy
    webBaseUrl: string
  },
): Promise<ShareCardResult> {
  if (!supportsPut(storage)) {
    throw new ApiError(ERROR_CODES.INTERNAL, 'Storage is not configured for share cards')
  }

  const png = await renderCard(
    await cardElement(input.kind, input.copy, input.shape, await profileQr(input.copy.handle)),
    input.shape,
  )

  const id = randomUUID().replaceAll('-', '').slice(0, 22)
  // Under the owner's own prefix, like every other object they own, so the
  // account purge sweeps these out with the rest of their media.
  const imageUrl = await storage.putObject(`cards/${input.userId}/${id}.png`, png, 'image/png')

  const card: ShareCard = {
    _id: id,
    userId: input.userId,
    kind: input.kind,
    shape: input.shape,
    imageUrl,
    headline: input.copy.headline,
    caption: input.copy.caption,
    handle: input.copy.handle,
    createdAt: new Date(),
  }
  await db.collection<ShareCard>(COLLECTIONS.shareCards).insertOne(card)

  return { id, imageUrl, shareUrl: `${input.webBaseUrl}/s/${id}` }
}

/**
 * The owner's profile as a scannable code, or nothing.
 *
 * `inviteUrl` rather than `profileUrl`, matching the rule in `shareText.ts`:
 * an achievement is the moment a friend tries the app, and the referral marker
 * costs the picture nothing. A failure here loses the code and not the card —
 * a story without a QR is still a story.
 */
async function profileQr(handle: string): Promise<string | undefined> {
  try {
    const svg = await QRCode.toString(inviteUrl(handle.replace(/^@/, '')), {
      type: 'svg',
      // Same settings as `GET /public/qr/:handle`: `M` recovers about 15%,
      // which is what a camera pointed at a screen needs, and the margin is the
      // quiet zone a reader locks its edges against.
      errorCorrectionLevel: 'M',
      margin: 1,
    })
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
  } catch {
    return undefined
  }
}

/**
 * What the share page needs, for anyone at all.
 *
 * Unauthenticated by design and safe to be: everything here was already put on
 * a card by its owner in order to be posted publicly. It carries no email, no
 * age, no location and no post text — the three things a card can be about are
 * the owner's own numbers.
 */
export async function readShareCard(db: Db, id: string): Promise<ShareCard | null> {
  return db.collection<ShareCard>(COLLECTIONS.shareCards).findOne({ _id: id })
}
