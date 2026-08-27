import { DEFAULT_APP_CONFIG, type AppConfig } from '@langx/shared'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'

export interface AppConfigDoc extends Omit<AppConfig, 'updatedAt'> {
  _id: 'current'
  updatedAt: Date
}

const CONFIG_ID = 'current'

/**
 * How long a read is served from memory before going back to Mongo.
 *
 * The trade-off is explicit: every request consults this, so it cannot be a
 * database round-trip each time, but turning maintenance on has to take effect
 * quickly. Ten seconds is short enough that "flip the switch" feels immediate
 * and long enough that the read cost disappears.
 */
export const CONFIG_CACHE_MS = 10_000

let cached: { value: AppConfig; at: number } | null = null

function toDto(doc: AppConfigDoc | null): AppConfig {
  if (!doc) return { ...DEFAULT_APP_CONFIG, updatedAt: new Date(0).toISOString() }
  return {
    maintenance: doc.maintenance,
    minVersion: doc.minVersion,
    flags: doc.flags,
    updatedAt: doc.updatedAt.toISOString(),
  }
}

export async function getAppConfig(db: Db, now: number = Date.now()): Promise<AppConfig> {
  if (cached && now - cached.at < CONFIG_CACHE_MS) return cached.value

  try {
    const doc = await db.collection<AppConfigDoc>(COLLECTIONS.appConfig).findOne({ _id: CONFIG_ID })
    const value = toDto(doc)
    cached = { value, at: now }
    return value
  } catch {
    // If the database is unreachable, fall back to the last known config, or to
    // the permissive defaults. The alternative — throwing — would take the
    // whole API down over a *configuration* read, which is the opposite of
    // what this is for.
    return cached?.value ?? { ...DEFAULT_APP_CONFIG, updatedAt: new Date(0).toISOString() }
  }
}

/** Drops the memory cache. Used after a write so an operator sees their change at once. */
export function invalidateAppConfigCache(): void {
  cached = null
}

export async function updateAppConfig(
  db: Db,
  patch: Partial<Omit<AppConfig, 'updatedAt'>>,
): Promise<AppConfig> {
  const now = new Date()
  const result = await db.collection<AppConfigDoc>(COLLECTIONS.appConfig).findOneAndUpdate(
    { _id: CONFIG_ID },
    {
      $set: { ...patch, updatedAt: now },
      $setOnInsert: {
        ...(patch.maintenance ? {} : { maintenance: DEFAULT_APP_CONFIG.maintenance }),
        ...(patch.minVersion ? {} : { minVersion: DEFAULT_APP_CONFIG.minVersion }),
        ...(patch.flags ? {} : { flags: DEFAULT_APP_CONFIG.flags }),
      },
    },
    { upsert: true, returnDocument: 'after' },
  )
  invalidateAppConfigCache()
  return toDto(result)
}

export async function setMaintenance(
  db: Db,
  enabled: boolean,
  message = '',
  until: string | null = null,
): Promise<AppConfig> {
  return updateAppConfig(db, { maintenance: { enabled, message, until } })
}
