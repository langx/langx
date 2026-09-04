/**
 * Every push device one account has, and what is wrong with the set.
 *
 * Read-only. Written for the report that notifications only reached the most
 * recently used phone, where the first question — did the second device ever
 * register at all? — could not be answered without opening a Mongo shell.
 * `POST /me/devices` answers 204 unconditionally and the app swallows every
 * failure, so a device that failed to register looks exactly like one that
 * succeeded.
 *
 * It flags the three things worth knowing: rows with no `deviceId` (an
 * installed build that predates it, whose identity is still its Expo token
 * alone), two rows claiming the same token, and devices that have been
 * silenced — which is a setting, not a fault, and is the answer when somebody
 * says one phone stopped buzzing.
 *
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env --env-file=../../.env.prod \
 *     scripts/inspect-devices.ts --handle <handle>
 */
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import type { Device } from '../src/modules/push/devices'
import type { Profile } from '../src/modules/profiles/profiles'

function argOf(flag: string): string | undefined {
  const at = process.argv.indexOf(flag)
  return at >= 0 ? process.argv[at + 1] : undefined
}

const handle = argOf('--handle')
if (!handle) throw new Error('--handle <handle> is required')

const env = loadEnv()
const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

try {
  const profile = await db.collection<Profile>(COLLECTIONS.profiles).findOne({ handle })
  if (!profile) {
    console.log(`no profile with handle @${handle}`)
  } else {
    const userId = String(profile._id)
    const devices = await db
      .collection<Device>(COLLECTIONS.devices)
      .find({ userId })
      .sort({ updatedAt: -1 })
      .toArray()

    console.log(`@${handle}  ${userId}`)
    console.log(`devices: ${devices.length}\n`)

    for (const device of devices) {
      const silenced = device.pushEnabled === false ? '  SILENCED' : ''
      console.log(`  deviceId   ${device.deviceId ?? '— (pre-deviceId build)'}${silenced}`)
      console.log(`  platform   ${device.platform}   locale ${device.locale ?? '—'}`)
      console.log(`  token      ${device.pushToken}`)
      console.log(`  created    ${device.createdAt.toISOString()}`)
      console.log(`  updated    ${device.updatedAt.toISOString()}\n`)
    }

    const withoutId = devices.filter((device) => !device.deviceId).length
    const silenced = devices.filter((device) => device.pushEnabled === false).length
    const tokens = new Set(devices.map((device) => device.pushToken))
    console.log(`rows without a deviceId: ${withoutId}`)
    console.log(`silenced on the device:  ${silenced}`)
    console.log(`distinct tokens:         ${tokens.size} of ${devices.length}`)
    console.log(`deliverable right now:   ${devices.length - silenced}`)
  }

  // The same three counts across the whole collection, so one account's shape
  // can be compared against everybody's.
  const collection = db.collection<Device>(COLLECTIONS.devices)
  const [total, legacy, off] = await Promise.all([
    collection.countDocuments({}),
    collection.countDocuments({ deviceId: { $exists: false } }),
    collection.countDocuments({ pushEnabled: false }),
  ])
  console.log(`\nall devices: ${total}   without a deviceId: ${legacy}   silenced: ${off}`)
} finally {
  await close()
}
