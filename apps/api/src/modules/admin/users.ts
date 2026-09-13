import {
  NOTIFICATION_TYPES,
  notificationsAllowed,
  type NotificationType,
  type PlanTier,
} from '@langx/shared'
import type { Db, Document } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { readAdminActions, type AdminAction } from './auditLog'
import { blockedUserIds } from '../moderation/blocks'
import { resolveDiscoveryScope } from '../discovery/discovery'
import { effectiveTier } from '../profiles/entitlement'
import type { Device } from '../push/devices'
import type { EmailSuppression } from '../notifications/suppressions'
import { emailFor } from '../profiles/emailFor'
import { findProfileByHandleOrId, type Profile } from '../profiles/profiles'

/**
 * One account, as the person answering a support thread needs to see it.
 *
 * The support mailbox asks the same four questions over and over — "my
 * Discover is empty", "I get no notifications", "my mail never arrives", "my
 * old data did not come back" — and every one of them is answerable from this
 * database with an indexed read. Until now answering meant opening a shell and
 * writing the query by hand, which is why they mostly went unanswered.
 */

/**
 * Built by naming fields, the way `toPublicProfile` is, rather than by
 * removing them: a field added to `Profile` later is private here by default
 * instead of being published by an omission nobody noticed.
 */
export interface AdminUserView {
  userId: string
  handle: string
  previousHandle: string | null
  displayName: string
  avatarUrl: string | null
  bio: string | null
  country: string | null
  cityName: string | null
  birthDate: string | null
  gender: string
  createdAt: string
  lastActiveAt: string | null
  build: { version: string; platform: string } | null
  tier: PlanTier
  official: boolean
  admin: boolean
  guest: boolean
  /** The point of a support lookup, and the reason this view is admin-only. */
  email: string | null
  emailVerified: boolean
  deletedAt: string | null
  tokenFrozenAt: string | null
  suspension: Profile['suspension'] | null
  counts: { reportsAgainst: number; reportsFiled: number; blockedBy: number }
  /** What has been done to this account, and by whom. */
  actions: AdminAction[]
}

export interface DiscoveryDiagnosis {
  /** What Discover would return for them right now. */
  matches: number
  /**
   * The same filter built up one clause at a time, so the step where the
   * number collapses is the answer. Cumulative, in the order Discover applies
   * them.
   */
  steps: { filter: string; remaining: number }[]
  discoverable: boolean
  nativeLanguages: string[]
  learning: string[]
}

export interface PushDiagnosis {
  devices: {
    platform: string
    pushEnabled: boolean
    hasDeviceId: boolean
    locale: string | null
    updatedAt: string | null
  }[]
  /** Per kind, per channel, resolved through the one reader — see `notificationsAllowed`. */
  prefs: { type: NotificationType; push: boolean; email: boolean }[]
  /** Why no mail can reach them, when that is the answer. */
  suppression: { reason: string; at: string } | null
}

export interface LegacyDiagnosis {
  /** A v1 row staged by the ETL under a handle they may not have claimed yet. */
  staged: boolean
  reserved: boolean
  restored: boolean
  previousHandle: string | null
}

export interface AdminUserDetail {
  user: AdminUserView
  discovery: DiscoveryDiagnosis
  push: PushDiagnosis
  legacy: LegacyDiagnosis
}

/** Handle, previous handle, user id, or the email address a support thread came from. */
export async function findAdminUser(db: Db, q: string): Promise<Profile | null> {
  const direct = await findProfileByHandleOrId(db, q, { includeDeleted: true })
  if (direct) return direct

  const user = await db
    .collection<{ _id: unknown; email: string }>(COLLECTIONS.user)
    .findOne({ email: q.trim().toLowerCase() })
  if (!user) return null
  return db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: String(user._id) })
}

export async function getAdminUser(db: Db, profile: Profile): Promise<AdminUserDetail> {
  const [user, discovery, push, legacy] = await Promise.all([
    toAdminUserView(db, profile),
    diagnoseDiscovery(db, profile),
    diagnosePush(db, profile),
    diagnoseLegacy(db, profile),
  ])
  return { user, discovery, push, legacy }
}

async function toAdminUserView(db: Db, profile: Profile): Promise<AdminUserView> {
  const [address, reportsAgainst, reportsFiled, blockedBy, actions] = await Promise.all([
    emailFor(db, profile._id),
    db.collection(COLLECTIONS.reports).countDocuments({ reportedId: profile._id }),
    db.collection(COLLECTIONS.reports).countDocuments({ reporterId: profile._id }),
    db.collection(COLLECTIONS.blocks).countDocuments({ blockedId: profile._id }),
    readAdminActions(db, profile._id),
  ])

  return {
    userId: profile._id,
    handle: profile.handle,
    previousHandle: profile.previousHandle ?? null,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl ?? null,
    bio: profile.bio ?? null,
    country: profile.country ?? null,
    cityName: profile.cityName ?? null,
    birthDate: profile.birthDate ?? null,
    gender: profile.gender,
    createdAt: profile.createdAt.toISOString(),
    lastActiveAt: profile.stats?.lastActiveAt
      ? new Date(profile.stats.lastActiveAt).toISOString()
      : null,
    build: profile.stats?.appVersion
      ? { version: profile.stats.appVersion, platform: profile.stats.appPlatform ?? 'unknown' }
      : null,
    tier: effectiveTier(profile),
    official: profile.official === true,
    admin: profile.admin === true,
    guest: profile.guest === true,
    email: address?.email ?? null,
    emailVerified: address?.verified === true,
    deletedAt: profile.deletedAt ? profile.deletedAt.toISOString() : null,
    tokenFrozenAt: profile.tokenFrozenAt ? new Date(profile.tokenFrozenAt).toISOString() : null,
    suspension: profile.suspension ?? null,
    counts: { reportsAgainst, reportsFiled, blockedBy },
    actions,
  }
}

/**
 * Why Discover is empty for this person.
 *
 * The last number is the real one: it comes from `resolveDiscoveryScope`, the
 * same function the feature itself calls, so a diagnosis cannot quietly
 * disagree with the screen it is explaining. The steps before it are that same
 * filter built up a clause at a time — the first big drop is the cause, and in
 * practice it is either the language pair or the size of the app.
 */
export async function diagnoseDiscovery(db: Db, profile: Profile): Promise<DiscoveryDiagnosis> {
  const profiles = db.collection<Profile>(COLLECTIONS.profiles)
  /*
   * The default search, which is what somebody means when they say Discover is
   * empty: no filters, the sort the app opens on. Naming a language scope
   * would change the answer — see the cross-match note in `resolveDiscoveryScope`.
   */
  const scope = await resolveDiscoveryScope(db, profile._id, {
    sort: 'recommended',
    limit: 1,
  })
  const excluded = [profile._id, ...(await blockedUserIds(db, profile._id))]

  const steps: DiscoveryDiagnosis['steps'] = []
  let filter: Document = {}
  const add = async (name: string, clause: Document) => {
    filter = { ...filter, ...clause }
    steps.push({ filter: name, remaining: await profiles.countDocuments(filter) })
  }

  await add('everybody', { guest: { $exists: false }, deletedAt: { $exists: false } })
  await add('discoverable', { 'settings.discoverable': true })
  await add('not suspended', { 'suspension.until': { $not: { $gt: new Date() } } })
  await add('not blocked either way', { _id: { $nin: excluded } })

  const matches = await profiles.countDocuments(scope.match)
  steps.push({ filter: 'language fit', remaining: matches })

  return {
    matches,
    steps,
    discoverable: profile.settings?.discoverable === true,
    nativeLanguages: profile.nativeLanguages.map((language) => language.code),
    learning: profile.learning.map((language) => language.code),
  }
}

/** Why no notification arrives: the phones, the switches, or the mail itself. */
async function diagnosePush(db: Db, profile: Profile): Promise<PushDiagnosis> {
  const [devices, address] = await Promise.all([
    db.collection<Device>(COLLECTIONS.devices).find({ userId: profile._id }).toArray(),
    emailFor(db, profile._id),
  ])

  const suppression = address
    ? await db
        .collection<EmailSuppression>(COLLECTIONS.emailSuppressions)
        .findOne({ _id: address.email.trim().toLowerCase() })
    : null

  return {
    devices: devices.map((device) => ({
      platform: device.platform,
      pushEnabled: device.pushEnabled !== false,
      hasDeviceId: device.deviceId !== undefined,
      locale: device.locale ?? null,
      updatedAt: device.updatedAt ? new Date(device.updatedAt).toISOString() : null,
    })),
    /*
     * Read through `notificationsAllowed` rather than printed raw. The field
     * holds three historical shapes — one boolean for everything, a bare
     * boolean per kind, and the current per-channel object — and only that
     * function knows what each means. A panel that showed the stored value
     * would be showing something nobody can act on.
     */
    prefs: NOTIFICATION_TYPES.map((type) => ({
      type,
      push: notificationsAllowed(profile.settings?.notifications, type, 'push'),
      email: notificationsAllowed(profile.settings?.notifications, type, 'email'),
    })),
    suppression: suppression
      ? { reason: suppression.reason, at: suppression.at.toISOString() }
      : null,
  }
}

/** Whether a returning v1 account actually came back, and how far it got. */
async function diagnoseLegacy(db: Db, profile: Profile): Promise<LegacyDiagnosis> {
  const handles = [profile.handle, profile.previousHandle].filter(
    (handle): handle is string => typeof handle === 'string',
  )
  const [staged, reserved] = await Promise.all([
    db.collection(COLLECTIONS.legacyProfiles).countDocuments({ handle: { $in: handles } }),
    db.collection(COLLECTIONS.handleReservations).countDocuments({ handle: { $in: handles } }),
  ])
  return {
    staged: staged > 0,
    reserved: reserved > 0,
    restored: profile.restoredFromV1 !== undefined,
    previousHandle: profile.previousHandle ?? null,
  }
}
