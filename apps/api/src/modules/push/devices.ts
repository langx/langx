import {
  STREAK_REMINDER_LOCAL_HOUR,
  localDayKey,
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
      $set: { userId, platform: input.platform, updatedAt: now },
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

export interface PushSender {
  send: (message: PushMessage) => Promise<void>
}

/**
 * Mirrors `NotConfiguredStorageProvider`: without credentials the app boots and
 * everything else works, and a push is a logged no-op rather than a crash. A
 * notification that fails to send must never fail the message that triggered it.
 */
export class LoggingPushSender implements PushSender {
  readonly sent: PushMessage[] = []

  send(message: PushMessage): Promise<void> {
    this.sent.push(message)
    return Promise.resolve()
  }
}

/** Expo's push service — one HTTP call, no SDK, no per-platform certificates. */
export class ExpoPushSender implements PushSender {
  readonly #endpoint = 'https://exp.host/--/api/v2/push/send'

  async send(message: PushMessage): Promise<void> {
    if (message.to.length === 0) return
    await fetch(this.#endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(
        message.to.map((token) => ({
          to: token,
          title: message.title,
          body: message.body,
          data: message.data,
          sound: 'default',
        })),
      ),
    })
  }
}

export async function tokensFor(db: Db, userId: string): Promise<string[]> {
  const devices = await db.collection<Device>(COLLECTIONS.devices).find({ userId }).toArray()
  return devices.map((d) => d.pushToken)
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
      'settings.notifications': true,
      deletedAt: { $exists: false },
    })
    .toArray()

  const candidates: { userId: string; streak: number }[] = []
  for (const profile of profiles) {
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
