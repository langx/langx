import {
  notificationsAllowed,
  DEFAULT_LOCALE,
  STREAK_REMINDER_LOCAL_HOUR,
  localDayKey,
  type Locale,
  type PushKind,
  type PushPlatform,
  type RegisterDeviceInput,
} from '@langx/shared'
import { type ObjectId, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { Profile } from '../profiles/profiles'

export interface Device {
  _id: ObjectId
  userId: string
  pushToken: string
  platform: PushPlatform
  /** Absent on devices registered before the app started sending one. */
  locale?: Locale
  createdAt: Date
  updatedAt: Date
}

/**
 * Upsert keyed on the **token**, not the user: a phone handed on to someone
 * else keeps the same Expo token, and the unique index on `pushToken` is what
 * stops the previous owner's notifications following it. Re-registering simply
 * moves the token to whoever is signed in now.
 */
export async function registerDevice(
  db: Db,
  userId: string,
  input: RegisterDeviceInput,
): Promise<void> {
  const now = new Date()
  await db.collection<Device>(COLLECTIONS.devices).updateOne(
    { pushToken: input.pushToken },
    {
      $set: {
        userId,
        platform: input.platform,
        updatedAt: now,
        ...(input.locale ? { locale: input.locale } : {}),
      },
      $setOnInsert: { pushToken: input.pushToken, createdAt: now },
    },
    { upsert: true },
  )
}

export async function unregisterDevice(db: Db, userId: string, pushToken: string): Promise<void> {
  await db.collection<Device>(COLLECTIONS.devices).deleteOne({ userId, pushToken })
}

export interface PushMessage {
  to: string[]
  title: string
  body: string
  data: { kind: PushKind; conversationId?: string }
}

/**
 * What a send tells us afterwards. Only the failures worth acting on: a token
 * Expo says is no longer installed anywhere.
 */
export interface PushResult {
  invalidTokens: string[]
}

export interface PushSender {
  send: (message: PushMessage) => Promise<PushResult>
}

/**
 * Mirrors `NotConfiguredStorageProvider`: without credentials the app boots and
 * everything else works, and a push is a logged no-op rather than a crash. A
 * notification that fails to send must never fail the message that triggered it.
 */
export class LoggingPushSender implements PushSender {
  readonly sent: PushMessage[] = []

  send(message: PushMessage): Promise<PushResult> {
    this.sent.push(message)
    return Promise.resolve({ invalidTokens: [] })
  }
}

/** Expo accepts at most this many messages in one request. */
const EXPO_BATCH_SIZE = 100

/** Expo's push service — one HTTP call, no SDK, no per-platform certificates. */
export class ExpoPushSender implements PushSender {
  readonly #endpoint = 'https://exp.host/--/api/v2/push/send'
  readonly #accessToken: string | undefined

  /**
   * `accessToken` is only needed when the Expo project has enhanced push
   * security switched on, which makes an unauthenticated send fail wholesale.
   * Unset is the normal case.
   */
  constructor(accessToken?: string) {
    this.#accessToken = accessToken
  }

  async send(message: PushMessage): Promise<PushResult> {
    const invalidTokens: string[] = []

    // Chunked because Expo rejects a request carrying more than 100 messages —
    // one popular account's devices will not reach that, but the streak
    // reminder fanning out over a whole timezone can.
    for (let index = 0; index < message.to.length; index += EXPO_BATCH_SIZE) {
      const batch = message.to.slice(index, index + EXPO_BATCH_SIZE)
      const response = await fetch(this.#endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
          ...(this.#accessToken ? { authorization: `Bearer ${this.#accessToken}` } : {}),
        },
        body: JSON.stringify(
          batch.map((token) => ({
            to: token,
            title: message.title,
            body: message.body,
            data: message.data,
            sound: 'default',
          })),
        ),
      })

      /**
       * The response was previously thrown away, which is the difference
       * between push working and push appearing to work. Expo answers 200 with
       * a *per-token* ticket, and a token belonging to an app that has been
       * uninstalled comes back `DeviceNotRegistered` — forever. Unread, those
       * tokens accumulate on the account and every later send wastes a slot on
       * a phone that will never show anything.
       *
       * Tickets are positional, so a ticket's index is its token's index.
       */
      if (!response.ok) continue
      const payload = (await response.json()) as {
        data?: { status: string; details?: { error?: string } }[]
      }
      payload.data?.forEach((ticket, ticketIndex) => {
        if (ticket.status === 'ok') return
        // Only DeviceNotRegistered is permanent. MessageRateExceeded and
        // MessageTooBig say something about this send, not about the device,
        // and deleting a token over either would silence a real phone.
        if (ticket.details?.error !== 'DeviceNotRegistered') return
        const token = batch[ticketIndex]
        if (token) invalidTokens.push(token)
      })
    }

    return { invalidTokens }
  }
}

/**
 * Send, then forget the phones that no longer exist.
 *
 * Wrapped rather than left to each caller because there are two call sites and
 * both would otherwise have to remember; a notification path that quietly
 * stops pruning is exactly the kind of thing nobody notices for a year.
 */
export async function sendPush(
  db: Db,
  sender: PushSender,
  message: PushMessage,
): Promise<PushResult> {
  const result = await sender.send(message)
  if (result.invalidTokens.length > 0) {
    await db
      .collection<Device>(COLLECTIONS.devices)
      .deleteMany({ pushToken: { $in: result.invalidTokens } })
  }
  return result
}

export async function tokensFor(db: Db, userId: string): Promise<string[]> {
  const devices = await db.collection<Device>(COLLECTIONS.devices).find({ userId }).toArray()
  return devices.map((d) => d.pushToken)
}

/**
 * The same tokens, grouped by the language to word the notification in.
 *
 * One Expo request per group rather than per device: a person with a phone and
 * a tablet in the same language is one send, and the two-language case — rare,
 * and the whole reason the locale is on the device — is two.
 *
 * A device that predates the field falls back to English rather than to the
 * account's language, because there is no account language: the app has never
 * stored one, deliberately.
 */
export async function tokensByLocale(db: Db, userId: string): Promise<Map<Locale, string[]>> {
  const devices = await db.collection<Device>(COLLECTIONS.devices).find({ userId }).toArray()
  const grouped = new Map<Locale, string[]>()
  for (const device of devices) {
    const locale = device.locale ?? DEFAULT_LOCALE
    const tokens = grouped.get(locale)
    if (tokens) tokens.push(device.pushToken)
    else grouped.set(locale, [device.pushToken])
  }
  return grouped
}

/**
 * Users who should get tonight's "keep your streak" nudge: it is
 * `STREAK_REMINDER_LOCAL_HOUR` **where they are**, they have a streak worth
 * saving, and they have not already acted today.
 *
 * Local hour, like the streak itself — a reminder at 8pm UTC is 5am in Tokyo,
 * which is not a nudge, it is an alarm clock.
 */
export async function streakReminderCandidates(
  db: Db,
  now: Date = new Date(),
): Promise<{ userId: string; streak: number }[]> {
  const profiles = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find({
      'streak.current': { $gte: 1 },
      // The streak nudge is its own switch now. `$ne: false` keeps the two
      // shapes that mean "yes" — the matrix, and the old single boolean — and
      // `notificationsAllowed` below settles the ones this cannot express.
      'settings.notifications': { $ne: false },
      deletedAt: { $exists: false },
    })
    .toArray()

  const candidates: { userId: string; streak: number }[] = []
  for (const profile of profiles) {
    if (!notificationsAllowed(profile.settings?.notifications, 'streak', 'push')) continue
    const zone = profile.timezone ?? 'UTC'
    const localHour = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: zone,
        hour: '2-digit',
        hour12: false,
      }).format(now),
    )
    if (localHour !== STREAK_REMINDER_LOCAL_HOUR) continue
    if (profile.streak.lastQualifiedDay === localDayKey(now, zone)) continue
    candidates.push({ userId: profile._id, streak: profile.streak.current })
  }
  return candidates
}
