import { recapHighlights, type RecapCardInput } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { isOwnBucketUrl } from '../../lib/assertOwnBucket'
import { sniffImageType } from '../../lib/sniffImageType'
import { recapForMonth } from '../notifications/newsletter'
import type { Profile } from '../profiles/profiles'
import type { RecapCardContent } from './recapDesign'

/** A face on a card is drawn at most ~140px across; nothing bigger is worth the wait. */
const MAX_AVATAR_BYTES = 1024 * 1024
const AVATAR_TIMEOUT_MS = 3000

/**
 * The owner's photo as a data URI satori can draw, or nothing.
 *
 * PNG and JPEG only, read from the bytes rather than the header — a stored
 * content type is a claim, and satori given a WebP draws an empty square
 * rather than failing. Anything else, anything slow and anything outside our
 * own bucket falls back to the handle's initial: a recap without a face is
 * still a recap, and this is never worth failing a share over.
 */
export async function fetchCardAvatar(
  url: string | undefined,
  storagePublicBaseUrl: string | undefined,
): Promise<string | undefined> {
  if (!url || !isOwnBucketUrl(storagePublicBaseUrl, url)) return undefined
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(AVATAR_TIMEOUT_MS) })
    if (!response.ok) return undefined
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_AVATAR_BYTES) return undefined
    const type = sniffImageType(bytes)
    if (type !== 'image/png' && type !== 'image/jpeg') return undefined
    return `data:${type};base64,${Buffer.from(bytes).toString('base64')}`
  } catch {
    return undefined
  }
}

/** "septembre" → "Septembre": the month is a headline on the card. */
function capitalise(text: string, locale: string): string {
  const [first = '', ...rest] = [...text]
  return first.toLocaleUpperCase(locale) + rest.join('')
}

/**
 * What a recap card says, with the numbers read here.
 *
 * The client sends the words and the month; the server reads the month's
 * numbers from the same rows `GET /me/recap` does and picks the same four
 * `recapHighlights` picks for the story's last slide. A label arrives already
 * in the plural form for the count the app was showing — for a finished month
 * that is the same count, and at worst a label one form off, never a number
 * the ledger does not hold.
 */
export async function recapCardContent(
  db: Db,
  input: {
    userId: string
    handle: string
    /** The card's headline: the month's name, in the reader's language. */
    monthName: string
    recap: RecapCardInput
    storagePublicBaseUrl: string | undefined
  },
): Promise<RecapCardContent> {
  const { recap, userId } = input
  const [numbers, profile] = await Promise.all([
    recapForMonth(db, userId, recap.month),
    db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ _id: userId }, { projection: { avatarUrl: 1 } }),
  ])
  const format = new Intl.NumberFormat(recap.locale)
  const avatar = await fetchCardAvatar(profile?.avatarUrl, input.storagePublicBaseUrl)
  return {
    month: capitalise(input.monthName, recap.locale),
    year: new Intl.NumberFormat(recap.locale, { useGrouping: false }).format(
      Number(recap.month.slice(0, 4)),
    ),
    kicker: recap.kicker,
    ...(recap.people && numbers.partners > 0 ? { people: recap.people } : {}),
    ...(recap.languages ? { languages: recap.languages } : {}),
    stats: recapHighlights(numbers).map((stat) => ({
      stat,
      value: format.format(numbers[stat]),
      label: recap.labels[stat],
    })),
    handle: input.handle,
    ...(avatar ? { avatar } : {}),
    locale: recap.locale,
  }
}
