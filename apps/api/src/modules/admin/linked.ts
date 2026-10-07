import {
  ADMIN_LINK_NETWORK_DAYS,
  ADMIN_LINKED_MAX,
  type AdminLinkedAccount,
  type AdminLinkedAccounts,
  type AdminLinkVia,
} from '@langx/shared'
import { ObjectId, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { authId } from '../../lib/authId'
import type { Report } from '../moderation/blocks'
import { isSuspended } from '../moderation/suspension'
import type { Profile } from '../profiles/profiles'
import type { Device } from '../push/devices'

/**
 * Other accounts that share a network or an installation with this one — the
 * operator's first question about a scammer who comes back under a new handle.
 *
 * Two sources, and they are not equally strong:
 *
 * - **network**: Better Auth stamps `ipAddress` on a session when it is
 *   created and never rewrites it, so `createdAt` is when that address was
 *   seen. Only sessions still in the collection count — signing out deletes
 *   the row, and with it the evidence. There is no index on `ipAddress` and
 *   none may be added: `session` is Better Auth's, and an index declared on
 *   its collections has crash-looped the API before. The second read below is
 *   therefore a scan, bounded by the date, and acceptable for a lookup an
 *   operator opens by hand.
 * - **device**: `devices.deviceId` is the installation's own id, and a phone
 *   handed between accounts keeps one row per `(userId, deviceId)`.
 *
 * The addresses never leave this function. The caller gets a count of shared
 * networks per account, which is what a decision needs, and nothing that
 * would put somebody's IP on a screen.
 */
export async function findLinkedAccounts(
  db: Db,
  userId: string,
  now: Date = new Date(),
): Promise<AdminLinkedAccounts> {
  const [byNetwork, byDevice] = await Promise.all([
    sharedNetworks(db, userId, now),
    sharedDevices(db, userId),
  ])

  const ids = new Set([...byNetwork.keys(), ...byDevice.keys()])
  ids.delete(userId)

  /*
   * A shared installation outranks any number of shared networks — a phone is
   * one person far more often than an address is — and within each, more
   * shared is stronger. The cap keeps the strongest.
   */
  const ranked = [...ids]
    .map((id) => ({ id, devices: byDevice.get(id) ?? 0, networks: byNetwork.get(id) ?? 0 }))
    .sort((a, b) => b.devices - a.devices || b.networks - a.networks)
  const kept = ranked.slice(0, ADMIN_LINKED_MAX)

  const [profiles, reports] = await Promise.all([
    db
      .collection<Profile>(COLLECTIONS.profiles)
      .find(
        { _id: { $in: kept.map((row) => row.id) } },
        { projection: { handle: 1, displayName: 1, createdAt: 1, suspension: 1 } },
      )
      .toArray(),
    openReportCounts(
      db,
      kept.map((row) => row.id),
    ),
  ])
  const profileById = new Map(profiles.map((profile) => [profile._id, profile]))

  const items: AdminLinkedAccount[] = []
  for (const row of kept) {
    const profile = profileById.get(row.id)
    // An account that signed up and never finished onboarding has no handle to
    // show or open; it is left out rather than drawn as a blank row.
    if (!profile) continue
    const via: AdminLinkVia[] = []
    if (row.networks > 0) via.push('network')
    if (row.devices > 0) via.push('device')
    items.push({
      userId: profile._id,
      handle: profile.handle,
      displayName: profile.displayName,
      createdAt: new Date(profile.createdAt).toISOString(),
      suspended: isSuspended(profile, now),
      openReports: reports.get(profile._id) ?? 0,
      via,
      sharedNetworks: row.networks,
      sharedDevices: row.devices,
    })
  }

  return { items, truncated: ranked.length > ADMIN_LINKED_MAX }
}

/** Other user id → how many of this user's recent addresses they also used. */
async function sharedNetworks(db: Db, userId: string, now: Date): Promise<Map<string, number>> {
  // Official accounts and anything else not minted by Better Auth have no
  // sessions, and `authId` would throw on an id that is not an ObjectId.
  if (!ObjectId.isValid(userId)) return new Map()

  const since = new Date(now.getTime() - ADMIN_LINK_NETWORK_DAYS * 24 * 60 * 60 * 1000)
  const sessions = db.collection<{ userId: ObjectId; ipAddress?: string | null; createdAt: Date }>(
    COLLECTIONS.session,
  )
  /*
   * Better Auth writes "" when it could not read an address, and falls back to
   * loopback in development and test. Neither is a network: counting them
   * would link every account on a dev database to every other.
   */
  const recent = {
    createdAt: { $gte: since },
    ipAddress: { $nin: [null, '', '127.0.0.1', '::1'] },
  }

  const own = (await sessions.distinct('ipAddress', {
    userId: authId(userId),
    ...recent,
  })) as string[]
  if (own.length === 0) return new Map()

  const others = await sessions
    .aggregate<{ _id: ObjectId; networks: number }>([
      { $match: { ...recent, ipAddress: { $in: own }, userId: { $ne: authId(userId) } } },
      { $group: { _id: '$userId', addresses: { $addToSet: '$ipAddress' } } },
      { $project: { networks: { $size: '$addresses' } } },
    ])
    .toArray()
  return new Map(others.map((row) => [String(row._id), row.networks]))
}

/** Other user id → how many of this user's installations they were also on. */
async function sharedDevices(db: Db, userId: string): Promise<Map<string, number>> {
  const devices = db.collection<Device>(COLLECTIONS.devices)
  const own = (await devices.distinct('deviceId', {
    userId,
    deviceId: { $exists: true },
  })) as string[]
  if (own.length === 0) return new Map()

  const others = await devices
    .aggregate<{ _id: string; devices: number }>([
      { $match: { deviceId: { $in: own }, userId: { $ne: userId } } },
      { $group: { _id: '$userId', ids: { $addToSet: '$deviceId' } } },
      { $project: { devices: { $size: '$ids' } } },
    ])
    .toArray()
  return new Map(others.map((row) => [row._id, row.devices]))
}

/** Reports against each account that nobody has decided yet. */
async function openReportCounts(db: Db, userIds: string[]): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map()
  const rows = await db
    .collection<Report>(COLLECTIONS.reports)
    .aggregate<{ _id: string; count: number }>([
      { $match: { status: { $in: ['open', 'reviewing'] }, reportedId: { $in: userIds } } },
      { $group: { _id: '$reportedId', count: { $sum: 1 } } },
    ])
    .toArray()
  return new Map(rows.map((row) => [row._id, row.count]))
}
