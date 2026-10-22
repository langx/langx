import { DEFAULT_APP_CONFIG } from '@langx/shared'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { COLLECTIONS } from '../../db/collections'
import { connectToDatabase, type DbHandle } from '../../db/client'
import {
  getAppConfig,
  invalidateAppConfigCache,
  setAppConfigFlag,
  type AppConfigFlagName,
} from './appConfig'

describe('setAppConfigFlag', () => {
  let replSet: MongoMemoryReplSet
  let handle: DbHandle

  beforeAll(async () => {
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
    handle = await connectToDatabase(replSet.getUri(), 'langx_app_config_flag_test')
  }, 120_000)

  afterEach(async () => {
    await handle.db.collection(COLLECTIONS.appConfig).deleteMany({})
    invalidateAppConfigCache()
  })

  afterAll(async () => {
    await handle?.close()
    await replSet?.stop()
  })

  const writeBehindTheCache = (fields: Record<string, boolean>) =>
    handle.db
      .collection(COLLECTIONS.appConfig)
      .updateOne(
        { _id: 'current' as never },
        { $set: Object.fromEntries(Object.entries(fields).map(([k, v]) => [`flags.${k}`, v])) },
      )

  // Every caller of this — the Flags page, the captcha route and
  // `scripts/maintenance.ts flag` — so each is shown not to undo a switch
  // another machine made inside this machine's ten-second cache.
  it.each<AppConfigFlagName>(['captchaRequired', 'v3Home', 'translationEnabled'])(
    'setting %s keeps a switch made behind a warm cache',
    async (flag) => {
      await setAppConfigFlag(handle.db, 'proWeek', false)
      const stale = await getAppConfig(handle.db)
      expect(stale.flags.copilotEnabled).toBe(false)

      await writeBehindTheCache({ copilotEnabled: true })
      // The cache still says off: what a read-modify-write would write back.
      expect((await getAppConfig(handle.db)).flags.copilotEnabled).toBe(false)

      const config = await setAppConfigFlag(handle.db, flag, !DEFAULT_APP_CONFIG.flags[flag])
      expect(config.flags.copilotEnabled).toBe(true)
      expect(config.flags[flag]).toBe(!DEFAULT_APP_CONFIG.flags[flag])

      const stored = await handle.db
        .collection<{ flags: Record<string, boolean> }>(COLLECTIONS.appConfig)
        .findOne({ _id: 'current' as never })
      expect(stored?.flags.copilotEnabled).toBe(true)
    },
  )

  it('writes only its own path, not the defaults for the rest', async () => {
    await setAppConfigFlag(handle.db, 'captchaRequired', true)
    const stored = await handle.db
      .collection<{ flags: Record<string, boolean> }>(COLLECTIONS.appConfig)
      .findOne({ _id: 'current' as never })
    expect(stored?.flags).toEqual({ captchaRequired: true })
    // The rest read as their defaults, laid under the stored partial.
    expect((await getAppConfig(handle.db)).flags).toEqual({
      ...DEFAULT_APP_CONFIG.flags,
      captchaRequired: true,
    })
  })

  it('refuses a name the schema does not know, and writes nothing', async () => {
    for (const flag of ['notAFlag', '__proto__', 'constructor']) {
      await expect(
        setAppConfigFlag(handle.db, flag as AppConfigFlagName, true),
        flag,
      ).rejects.toThrow('unknown flag')
    }
    expect(await handle.db.collection(COLLECTIONS.appConfig).countDocuments()).toBe(0)
  })
})
