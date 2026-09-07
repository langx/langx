/**
 * Turn maintenance on and off, and set the minimum client version.
 *
 * A script rather than an admin endpoint: this is the control you reach for
 * when something is wrong, and it should not depend on the API being healthy
 * enough to authenticate you. It talks to Mongo directly.
 *
 *   pnpm --filter @langx/api exec tsx scripts/maintenance.ts status
 *   pnpm --filter @langx/api exec tsx scripts/maintenance.ts on "Back at 14:00 UTC" 2026-08-27T14:00:00Z
 *   pnpm --filter @langx/api exec tsx scripts/maintenance.ts off
 *   pnpm --filter @langx/api exec tsx scripts/maintenance.ts min-version ios 2.1.0
 *   pnpm --filter @langx/api exec tsx scripts/maintenance.ts flag translationEnabled false
 */
import { appConfigSchema, minVersionSchema } from '@langx/shared'
import { connectToDatabase } from '../src/db/client'
import { loadEnv } from '../src/env'
import { getAppConfig, setMaintenance, updateAppConfig } from '../src/modules/appConfig/appConfig'

/**
 * The only property names this script may write, read off the schema so a new
 * flag or platform is one edit. An operator's typo used to become a stray key
 * in the config document — `minVersion.andriod` — that nothing read and that
 * the schema then rejected on the next load.
 */
const MIN_VERSION_PLATFORMS = Object.keys(minVersionSchema.shape)
const FLAG_NAMES = Object.keys(appConfigSchema.shape.flags.shape)

function knownKey(candidate: string, allowed: string[], what: string): string {
  const match = allowed.find((key) => key === candidate)
  if (match === undefined) {
    throw new Error(`unknown ${what} "${candidate}" — one of: ${allowed.join(', ')}`)
  }
  return match
}

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
        const [candidate, version] = args
        if (!candidate || !version) throw new Error('usage: min-version <ios|android|web> <x.y.z>')
        const platform = knownKey(candidate, MIN_VERSION_PLATFORMS, 'platform')
        const current = await getAppConfig(db, Number.POSITIVE_INFINITY)
        const next = { ...current.minVersion, [platform]: version }
        await updateAppConfig(db, { minVersion: next })
        console.log(`Minimum ${platform} version is now ${version}`)
        console.log('Clients below it get 426 UPDATE_REQUIRED and a forced-update screen.')
        break
      }
      case 'flag': {
        const [candidate, value] = args
        if (!candidate || (value !== 'true' && value !== 'false')) {
          throw new Error('usage: flag <name> <true|false>')
        }
        const name = knownKey(candidate, FLAG_NAMES, 'flag')
        const current = await getAppConfig(db, Number.POSITIVE_INFINITY)
        await updateAppConfig(db, {
          flags: { ...current.flags, [name]: value === 'true' },
        })
        console.log(`Flag ${name} is now ${value}`)
        break
      }
      default:
        console.log(
          'Commands: status | on [message] [untilIso] | off | min-version <p> <v> | flag <n> <bool>',
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
