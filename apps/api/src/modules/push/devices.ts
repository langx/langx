import {
  notificationsAllowed,
  DEFAULT_LOCALE,
  STREAK_REMINDER_LOCAL_HOUR,
  localDayKey,
  localHour,
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
  /**
   * The installation's own id. Absent on rows written by a build that predates
   * it — which is why every query here treats its absence as ordinary rather
   * than as a fault.
   */
  deviceId?: string
  /**
   * `false` when notifications have been switched off **on this phone**. The
   * account's per-kind settings are a different question and live on the
   * profile: those say *what*, this says *where*.
   *
   * Absent means on, so no existing row had to be backfilled.
   */
  pushEnabled?: boolean
  createdAt: Date
  updatedAt: Date
}

/** Rows a send may go to: everything but a device somebody has silenced. */
const DELIVERABLE = { pushEnabled: { $ne: false } } as const

/**
 * Records a phone, keyed on the installation where there is one.
 *
 * **With a `deviceId`** the row belongs to `(userId, deviceId)`, so an Expo
 * token that rotates updates the phone's own row instead of leaving an orphan
 * that receives nothing and is never pruned. Any other row still holding that
 * token is deleted first: the token is unique across the collection, and that
 * uniqueness is what stops a phone handed on to somebody else from carrying
 * the previous owner's notifications with it.
 *
 * **Without one** — every build already on a phone — this is exactly what it
 * was: an upsert keyed on the token, which moves it to whoever is signed in
 * now. Both paths have to keep working for as long as those builds are
 * installed, which is why `deviceId` is optional in the schema.
 */
export async function registerDevice(
  db: Db,
  userId: string,
  input: RegisterDeviceInput,
): Promise<void> {
  const now = new Date()
  const devices = db.collection<Device>(COLLECTIONS.devices)
  const shared = {
    userId,
    platform: input.platform,
    updatedAt: now,
    ...(input.locale ? { locale: input.locale } : {}),
    ...(input.pushEnabled === undefined ? {} : { pushEnabled: input.pushEnabled }),
  }

  if (!input.deviceId) {
    await devices.updateOne(
      { pushToken: input.pushToken },
      { $set: shared, $setOnInsert: { pushToken: input.pushToken, createdAt: now } },
      { upsert: true },
    )
    return
  }

  // Whoever else was holding this token is not holding it any more. Scoped by
  // token rather than by user so it also catches the row this same phone wrote
  // under a previous account.
  await devices.deleteMany({
    pushToken: input.pushToken,
    $or: [{ userId: { $ne: userId } }, { deviceId: { $ne: input.deviceId } }],
  })
  await devices.updateOne(
    { userId, deviceId: input.deviceId },
    {
      $set: { ...shared, pushToken: input.pushToken },
      $setOnInsert: { deviceId: input.deviceId, createdAt: now },
    },
    { upsert: true },
  )
}

/**
 * Forgets a phone. By installation where the caller knows one — signing out on
 * a phone whose token has rotated since it registered would otherwise leave
 * the row behind, still receiving.
 */
export async function unregisterDevice(
  db: Db,
  userId: string,
  input: { pushToken?: string; deviceId?: string },
): Promise<void> {
  if (input.deviceId) {
    await db.collection<Device>(COLLECTIONS.devices).deleteOne({ userId, deviceId: input.deviceId })
    return
  }
  if (!input.pushToken) return
  await db.collection<Device>(COLLECTIONS.devices).deleteOne({ userId, pushToken: input.pushToken })
}

/**
 * The switch on one device, which is the whole point of having an id for it:
 * silencing the phone in your pocket must leave the tablet receiving.
 *
 * Answers whether it matched, so the route can 404 rather than report success
 * for a device this account does not have.
 */
export async function setDevicePushEnabled(
  db: Db,
  userId: string,
  deviceId: string,
  pushEnabled: boolean,
): Promise<boolean> {
  const result = await db
    .collection<Device>(COLLECTIONS.devices)
    .updateOne({ userId, deviceId }, { $set: { pushEnabled, updatedAt: new Date() } })
  return result.matchedCount > 0
}

export interface PushMessage {
  to: string[]
  title: string
  body: string
  /**
   * What the app needs to act on the tap, and — for a message — to draw the
   * in-app banner that replaces the OS one while the app is open. `senderId`
   * is there for the avatar; the notification's own title is only a name.
   */
  data: { kind: PushKind; conversationId?: string; senderId?: string }
  /**
   * The number to put on the app icon — the recipient's unread total, from
   * the same `countUnread` that `/me/unread` answers with, so the icon, the
   * Chats tab and the list never disagree. Only the message push sets it;
   * absent means "leave the icon as it is", which is what every other kind
   * of push wants.
   */
  badge?: number
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
            ...(message.badge !== undefined ? { badge: message.badge } : {}),
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
  const devices = await db
    .collection<Device>(COLLECTIONS.devices)
    .find({ userId, ...DELIVERABLE })
    .toArray()
  return devices.map((d) => d.pushToken)
}

/**
 * The rows themselves, for a caller that has to decide per device rather than
 * per account — which today is the chat fan-out, and its reason is in
 * `devicesToPush`.
 */
export async function devicesFor(db: Db, userId: string): Promise<Device[]> {
  return db
    .collection<Device>(COLLECTIONS.devices)
    .find({ userId, ...DELIVERABLE })
    .toArray()
}

/**
 * Which of someone's devices should be woken, given the ones currently holding
 * a socket.
 *
 * The fan-out used to skip push entirely the moment the recipient held **any**
 * live socket, and that is what "only one of my two phones gets notifications"
 * turned out to be: the phone you have open silences the one in your pocket.
 * A socket is a fact about a device, not about an account.
 *
 * `connected` carries only the sockets that named a device. A client too old
 * to name one is handled by the caller, which keeps the old behaviour for it —
 * an installed build already draws its own in-app banner and must not start
 * getting an OS one on top.
 */
export function devicesToPush(devices: readonly Device[], connected: readonly string[]): string[] {
  const holding = new Set(connected)
  return devices
    .filter((device) => !(device.deviceId !== undefined && holding.has(device.deviceId)))
    .map((device) => device.pushToken)
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
  const devices = await db
    .collection<Device>(COLLECTIONS.devices)
    .find({ userId, ...DELIVERABLE })
    .toArray()
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
 * What language to word something for this person in, when there is no request
 * to read it off.
 *
 * The newest device wins: re-registering stamps `updatedAt`, so the most
 * recently opened app is the phone they actually use. There is no account
 * language to fall back on — deliberately, see `tokensByLocale` — so somebody
 * who only ever uses the web gets English.
 */
export async function localeFor(db: Db, userId: string): Promise<Locale> {
  const device = await db
    .collection<Device>(COLLECTIONS.devices)
    .findOne({ userId }, { sort: { updatedAt: -1 }, projection: { locale: 1 } })
  return device?.locale ?? DEFAULT_LOCALE
}

/**
 * Users who should get tonight's "keep your streak" nudge: it is
 * `STREAK_REMINDER_LOCAL_HOUR` **where they are**, they have a streak worth
 * saving, and they have not already acted today.
 *
 * Local hour, like the streak itself — a reminder at 8pm UTC is 5am in Tokyo,
 * which is not a nudge, it is an alarm clock.
 *
 * Both channels come back on the candidate rather than being decided here.
 * The nudge is a push to whoever has a phone signed in and an email to whoever
 * does not, and only the caller — which has already claimed the day in the
 * ledger — can see which of those it turned out to be. Filtering to
 * push-allowed here would drop the web-only accounts that the email exists for.
 */
export async function streakReminderCandidates(
  db: Db,
  now: Date = new Date(),
): Promise<{ userId: string; streak: number; push: boolean; email: boolean }[]> {
  const profiles = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .find({
      'streak.current': { $gte: 1 },
      // The streak nudge is its own switch. `$ne: false` only rules out the
      // oldest shape, a bare `false` meaning silence for everything; the other
      // two — the retired push/email matrix and today's boolean per kind — are
      // objects this cannot read into, so `notificationsAllowed` settles them
      // below. Its job is to bound the scan, not to decide.
      'settings.notifications': { $ne: false },
      deletedAt: { $exists: false },
    })
    .toArray()

  const candidates: { userId: string; streak: number; push: boolean; email: boolean }[] = []
  for (const profile of profiles) {
    const push = notificationsAllowed(profile.settings?.notifications, 'streak', 'push')
    const email = notificationsAllowed(profile.settings?.notifications, 'streak', 'email')
    if (!push && !email) continue
    const zone = profile.timezone ?? 'UTC'
    if (localHour(now, zone) !== STREAK_REMINDER_LOCAL_HOUR) continue
    if (profile.streak.lastQualifiedDay === localDayKey(now, zone)) continue
    candidates.push({ userId: profile._id, streak: profile.streak.current, push, email })
  }
  return candidates
}
