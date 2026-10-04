import type {
  ApnsEnvironment,
  CallEndpointPlatform,
  RegisterCallEndpointInput,
} from '@langx/shared'
import type { Db, ObjectId } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'

/**
 * A phone that can be rung while its app is not running.
 *
 * See `COLLECTIONS.callEndpoints` for why this is not a field on `devices`.
 * `deviceId` is the same installation id the push registration sends, so an
 * Android endpoint finds its Expo token through the `devices` row that shares
 * it, and an iPhone that has both can be told apart from one that has only a
 * PushKit token.
 */
export interface CallEndpoint {
  _id: ObjectId
  userId: string
  deviceId: string
  platform: CallEndpointPlatform
  /** The call protocol this installation speaks. See `CALL_PROTOCOL_VERSION`. */
  protocol: number
  /** The PushKit token and which of Apple's two hosts it belongs to. iOS only. */
  voip?: { token: string; environment: ApnsEnvironment }
  /** `false` where the system call screen is not allowed. Absent means allowed. */
  callKit?: boolean
  createdAt: Date
  updatedAt: Date
}

const endpoints = (db: Db) => db.collection<CallEndpoint>(COLLECTIONS.callEndpoints)

/**
 * Records a phone, keyed on the installation.
 *
 * Whoever else was holding this PushKit token stops holding it first, for
 * `registerDevice`'s reason: the token belongs to the phone, and a phone
 * handed on — or signed in to a second account — must not go on ringing for
 * the first one's calls.
 *
 * A registration that names no token *removes* one that was there. The app
 * sends what it has now, and "no token" from an iPhone means PushKit has taken
 * it back.
 */
export async function registerCallEndpoint(
  db: Db,
  userId: string,
  input: RegisterCallEndpointInput,
): Promise<void> {
  const now = new Date()
  const voip =
    input.platform === 'ios' && input.voipToken
      ? { token: input.voipToken, environment: input.apnsEnvironment ?? 'production' }
      : undefined

  if (voip) {
    await endpoints(db).deleteMany({
      'voip.token': voip.token,
      $or: [{ userId: { $ne: userId } }, { deviceId: { $ne: input.deviceId } }],
    })
  }

  await endpoints(db).updateOne(
    { userId, deviceId: input.deviceId },
    {
      $set: {
        platform: input.platform,
        protocol: input.protocol,
        updatedAt: now,
        ...(voip ? { voip } : {}),
        ...(input.callKit === undefined ? {} : { callKit: input.callKit }),
      },
      ...(voip ? {} : { $unset: { voip: '' } }),
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  )
}

/** Forgets a phone: signing out on it, which is also when its push row goes. */
export async function unregisterCallEndpoint(
  db: Db,
  userId: string,
  deviceId: string,
): Promise<void> {
  await endpoints(db).deleteOne({ userId, deviceId })
}

export async function callEndpointsFor(db: Db, userId: string): Promise<CallEndpoint[]> {
  return endpoints(db).find({ userId }).toArray()
}

/**
 * Apple said this token is no longer a phone. The endpoint row stays — the
 * installation may still exist and register a new token — but it stops being
 * something a VoIP push is sent to.
 */
export async function dropVoipToken(db: Db, token: string): Promise<void> {
  await endpoints(db).updateOne({ 'voip.token': token }, { $unset: { voip: '' } })
}

/** Every endpoint of an account, when the account itself is going. */
export async function deleteCallEndpointsOf(db: Db, userId: string): Promise<void> {
  await endpoints(db).deleteMany({ userId })
}
