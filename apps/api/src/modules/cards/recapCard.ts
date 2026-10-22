import { drawnFacePng, drawnFaceRev, FACE_OWNER_FIELDS, type FaceOwner } from '../avatars/surfaces'
import {
  recapCalendar,
  recapHighlights,
  recapSlides,
  yearCalendar,
  type MonthlyRecapDto,
  type RecapCardInput,
  type YearlyRecapDto,
} from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { sniffImageType } from '../../lib/sniffImageType'
import { recapForMonth, recapForYear } from '../notifications/newsletter'
import type { Profile } from '../profiles/profiles'
import type { StorageProviderWithPut } from '../../storage/StorageProvider'
import type { RecapCardContent } from './recapDesign'
import type { RecapSlideContent } from './recapSlideDesign'

/** A face on a card is drawn at most ~140px across; nothing bigger is worth the wait. */
const MAX_AVATAR_BYTES = 1024 * 1024
const AVATAR_TIMEOUT_MS = 3000

/**
 * The owner's photo as a data URI satori can draw, or nothing.
 *
 * **Read through the storage provider, never fetched by URL.** `avatarUrl` is
 * a string on a profile, and handing it to `fetch` made this a server-side
 * request to wherever that string pointed (CodeQL `js/request-forgery`). The
 * prefix check in front of it held, but it was the only thing standing
 * between a stored string and an outbound request. Now the URL is only ever
 * parsed: `keyFromPublicUrl` turns it into a key in our own bucket — or into
 * nothing — and the bytes come from the bucket's own API by that key. An
 * avatar key also has to be under `avatars/`, so no other object in the
 * bucket can be drawn as somebody's face.
 *
 * PNG and JPEG only, read from the bytes rather than the header — a stored
 * content type is a claim, and satori given a WebP draws an empty square
 * rather than failing. Anything else, anything slow and anything outside our
 * own bucket falls back to the handle's initial: a recap without a face is
 * still a recap, and this is never worth failing a share over.
 */
export async function fetchCardAvatar(
  url: string | undefined,
  storage: Pick<StorageProviderWithPut, 'getObject' | 'keyFromPublicUrl'> | undefined,
): Promise<string | undefined> {
  const key = url && storage ? storage.keyFromPublicUrl(url) : null
  if (!storage || !key || !key.startsWith('avatars/')) return undefined
  try {
    const bytes = await withTimeout(storage.getObject(key), AVATAR_TIMEOUT_MS)
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_AVATAR_BYTES) return undefined
    const type = sniffImageType(bytes)
    if (type !== 'image/png' && type !== 'image/jpeg') return undefined
    return `data:${type};base64,${Buffer.from(bytes).toString('base64')}`
  } catch {
    return undefined
  }
}

/** `promise`, or a rejection once `ms` have passed: a slow bucket costs the face, not the card. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timed out')), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * The drawn face for an owner without a photo, as a data URI: rendered in
 * process rather than fetched, at 160px for the card's largest disc (120px on
 * a story) in its full cut. Undefined for a photo, an official account or the
 * old style, and the card draws the handle's initial as before.
 */
export async function drawnCardAvatar(owner: FaceOwner): Promise<string | undefined> {
  const rev = drawnFaceRev(owner)
  const png = rev ? await drawnFacePng(rev, 160, 120) : null
  return png ? `data:image/png;base64,${png.toString('base64')}` : undefined
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
    /** The card's headline: the month's name, or the year, in the reader's language. */
    monthName: string
    recap: RecapCardInput
    /** Where the owner's photo is read from; without it the card draws their initial. */
    storage?: Pick<StorageProviderWithPut, 'getObject' | 'keyFromPublicUrl'>
  },
): Promise<RecapCardContent & { slide?: RecapSlideContent }> {
  const { recap, userId } = input
  // Four digits is a year's card, whose headline is the year itself.
  const yearly = recap.month.length === 4
  const [numbers, profile] = await Promise.all([
    yearly ? recapForYear(db, userId, recap.month) : recapForMonth(db, userId, recap.month),
    db
      .collection<Profile>(COLLECTIONS.profiles)
      .findOne({ _id: userId }, { projection: FACE_OWNER_FIELDS }),
  ])
  const format = new Intl.NumberFormat(recap.locale)
  // French groups digits with a narrow no-break space, which Nunito does not
  // have: satori drew "1204". The ordinary no-break space it does have.
  const show = (value: number): string => format.format(value).replace(/\u202f/g, '\u00a0')
  const avatar =
    (await fetchCardAvatar(profile?.avatarUrl, input.storage)) ??
    (profile ? await drawnCardAvatar(profile) : undefined)
  const content: RecapCardContent = {
    month: capitalise(input.monthName, recap.locale),
    ...(yearly
      ? {}
      : {
          year: new Intl.NumberFormat(recap.locale, { useGrouping: false }).format(
            Number(recap.month.slice(0, 4)),
          ),
        }),
    kicker: recap.kicker,
    ...(recap.people && numbers.partners > 0 ? { people: recap.people } : {}),
    ...(recap.languages ? { languages: recap.languages } : {}),
    stats: recapHighlights(numbers).map((stat) => ({
      stat,
      value: show(numbers[stat]),
      label: recap.labels[stat],
    })),
    handle: input.handle,
    ...(avatar ? { avatar } : {}),
    locale: recap.locale,
  }
  const slide = slideContent(content, numbers, recap, show)
  return slide ? { ...content, slide } : content
}

/**
 * The card of one slide, when one was asked for and the month earned it.
 *
 * A slide the story would not have shown — the corrections of a month with
 * none, from a build that disagrees with this one about the slides — gets the
 * summary poster instead: a card is never a zero to be congratulated on.
 */
function slideContent(
  content: RecapCardContent,
  numbers: MonthlyRecapDto | YearlyRecapDto,
  recap: RecapCardInput,
  show: (value: number) => string,
): RecapSlideContent | undefined {
  const slide = recap.slide
  if (!slide || slide === 'summary' || !recapSlides(numbers).includes(slide)) return undefined
  const base = { ...content, slide }
  switch (slide) {
    case 'intro':
      return base
    case 'messages':
      return { ...base, value: show(numbers.messages), label: recap.labels.messages }
    case 'corrections':
      return { ...base, value: show(numbers.corrections), label: recap.labels.corrections }
    case 'echo':
      return { ...base, value: show(numbers.echoReviews), label: recap.labels.echoReviews }
    case 'streak': {
      // The slide's number: the streak while one is alive, the active days
      // otherwise — the same choice `StreakSlide` makes.
      const streaking = numbers.currentStreak > 0
      return {
        ...base,
        value: show(streaking ? numbers.currentStreak : numbers.activeDays),
        label: streaking ? recap.labels.currentStreak : recap.labels.activeDays,
        ...('activeMonths' in numbers
          ? { months: yearCalendar(numbers) }
          : { days: recapCalendar(numbers) }),
      }
    }
  }
}
