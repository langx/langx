/**
 * Turn maintenance on and off, and set the client versions.
 *
 * A script rather than an admin endpoint: this is the control you reach for
 * when something is wrong, and it should not depend on the API being healthy
 * enough to authenticate you. It talks to Mongo directly.
 *
 *   pnpm --filter @langx/api exec tsx scripts/maintenance.ts status
 *   pnpm --filter @langx/api exec tsx scripts/maintenance.ts on "Back at 14:00 UTC" 2026-08-27T14:00:00Z
 *   pnpm --filter @langx/api exec tsx scripts/maintenance.ts off
 *   pnpm --filter @langx/api exec tsx scripts/maintenance.ts min-version ios 2.1.0
 *   pnpm --filter @langx/api exec tsx scripts/maintenance.ts latest-version ios 2.2.0
 *   pnpm --filter @langx/api exec tsx scripts/maintenance.ts flag translationEnabled false
 */
import { appConfigSchema, minVersionSchema } from '@langx/shared'
import { connectToDatabase } from '../src/db/client'
import { loadEnv } from '../src/env'
import { getAppConfig, setMaintenance, updateAppConfig } from '../src/modules/appConfig/appConfig'

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2)
  const env = loadEnv()
  const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

  try {
    switch (command) {
      case 'status': {
        console.log(JSON.stringify(await getAppConfig(db, Number.POSITIVE_INFINITY), null, 2))
        break
      }
      case 'on': {
        const message = args[0] ?? 'LangX is temporarily unavailable for maintenance.'
        const until = args[1] ?? null
        const config = await setMaintenance(db, true, message, until)
        console.log('Maintenance ON')
        console.log(JSON.stringify(config.maintenance, null, 2))
        console.log('\nTakes effect within the config cache TTL (10s).')
        break
      }
      case 'off': {
        await setMaintenance(db, false)
        console.log('Maintenance OFF')
        break
      }
      case 'min-version': {
        const [platform, version] = args
        // The argument becomes a property name, so it is checked against the
        // schema's own keys first: a typo gets a usage line, not a new field.
        const platformKey = minVersionSchema.keyof().safeParse(platform)
        if (!platformKey.success || !version) {
          throw new Error('usage: min-version <ios|android|web> <x.y.z>')
        }
        const current = await getAppConfig(db, Number.POSITIVE_INFINITY)
        const next = { ...current.minVersion, [platformKey.data]: version }
        await updateAppConfig(db, { minVersion: next })
        console.log(`Minimum ${platform} version is now ${version}`)
        console.log('Clients below it get 426 UPDATE_REQUIRED and a forced-update screen.')
        break
      }
      case 'latest-version': {
        const [platform, version] = args
        // Same key check as `min-version`, and the same reason for it.
        const platformKey = minVersionSchema.keyof().safeParse(platform)
        if (!platformKey.success || !version) {
          throw new Error('usage: latest-version <ios|android|web> <x.y.z>')
        }
        const current = await getAppConfig(db, Number.POSITIVE_INFINITY)
        const next = { ...current.latestVersion, [platformKey.data]: version }
        await updateAppConfig(db, { latestVersion: next })
        console.log(`Latest ${platform} version is now ${version}`)
        console.log('Clients below it get a dismissible banner. Nothing is blocked.')
        break
      }
      case 'flag': {
        const [name, value] = args
        // Same rule as `min-version`: only a flag the schema knows can be set.
        const flagKey = appConfigSchema.shape.flags.keyof().safeParse(name)
        if (!flagKey.success || (value !== 'true' && value !== 'false')) {
          throw new Error('usage: flag <name> <true|false>')
        }
        const current = await getAppConfig(db, Number.POSITIVE_INFINITY)
        await updateAppConfig(db, {
          flags: { ...current.flags, [flagKey.data]: value === 'true' },
        })
        console.log(`Flag ${name} is now ${value}`)
        break
      }
      default:
        console.log(
          'Commands: status | on [message] [untilIso] | off | min-version <p> <v> | ' +
            'latest-version <p> <v> | flag <n> <bool>',
        )
        process.exitCode = 1
    }
  } finally {
    await close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
