/**
 * Venus's social calendar: import it, approve it, look at what will go out.
 * See `docs/social-autoposting.md`.
 *
 *   cd apps/api
 *   pnpm exec tsx --env-file=../../.env scripts/social-calendar.ts <command> [options]
 *
 *   import <calendar.json> --start YYYY-MM-DD [--platforms instagram,facebook,youtube,tiktok]
 *       Writes every slot as a draft, one row per platform. Safe to run again:
 *       drafts take the file's words, an approved row the file changed goes
 *       back to draft, anything already out is left alone. `--start` is the
 *       date of dayOffset 0; without it the file's own `startDate` is used.
 *   approve [--offset N] [--platform p]
 *       Drafts → approved. Without --offset, the whole calendar except the
 *       language swaps still waiting for a native check, which are listed;
 *       each of those is approved by naming its --offset.
 *   alternate --offset N
 *       A language swap's drafts become its English alternate (`enAlternate`).
 *   skip --offset N [--platform p]
 *       Anything not yet out → skipped.
 *   --dry [--next N]
 *       Prints exactly what would be posted for the next N calendar days
 *       (default 7) and writes nothing. With `import` it reads the file; on
 *       its own it reads the database.
 *
 * `--version V` picks a calendar other than the newest imported. Writing to a
 * database that is not `*_dev` needs `--confirm`. Nothing here posts: the
 * API's scheduler does, and only with `flags.socialAutopost` on.
 */
import { readFile } from 'node:fs/promises'
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@langx/shared'
import { connectToDatabase } from '../src/db/client'
import { loadEnv } from '../src/env'
import { socialConnected } from '../src/modules/social/adapters'
import { calendarSlots, socialCalendarSchema } from '../src/modules/social/calendar'
import {
  approveSocialPosts,
  importSocialSlots,
  latestSocialCalendarVersion,
  nextSocialPosts,
  skipSocialPosts,
  useSocialAlternate,
  type SocialPostSlot,
} from '../src/modules/social/posts'
import { previewSocialPost } from '../src/modules/social/preview'

/** The zone the dry run prints local times in when no calendar file says. */
const DEFAULT_ZONE = 'America/Toronto'

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? undefined : process.argv[i + 1]
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

function intArg(name: string): number | undefined {
  const raw = arg(name)
  if (raw === undefined) return undefined
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0) throw new Error(`--${name} takes a whole number`)
  return value
}

function platformArg(): SocialPlatform | undefined {
  const raw = arg('platform')
  if (raw === undefined) return undefined
  const known = SOCIAL_PLATFORMS.find((platform) => platform === raw)
  if (!known) throw new Error(`--platform is one of ${SOCIAL_PLATFORMS.join(', ')}`)
  return known
}

function platformsArg(): SocialPlatform[] {
  const raw = arg('platforms')
  if (raw === undefined) return [...SOCIAL_PLATFORMS]
  return raw.split(',').map((name) => {
    const known = SOCIAL_PLATFORMS.find((platform) => platform === name.trim())
    if (!known) throw new Error(`--platforms takes ${SOCIAL_PLATFORMS.join(', ')}`)
    return known
  })
}

/** The rows of the first `days` calendar days at or after `now`. */
function firstDays<T extends Pick<SocialPostSlot, 'dayOffset' | 'scheduledAt'>>(
  rows: T[],
  days: number,
  now: Date,
): T[] {
  const ahead = rows.filter((row) => row.scheduledAt.getTime() >= now.getTime())
  const offsets = [...new Set(ahead.map((row) => row.dayOffset))].sort((a, b) => a - b)
  const keep = new Set(offsets.slice(0, days))
  return ahead
    .filter((row) => keep.has(row.dayOffset))
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
}

async function main(): Promise<void> {
  const command = process.argv[2]?.startsWith('--') ? undefined : process.argv[2]
  const dry = flag('dry')
  const next = intArg('next') ?? 7
  const env = loadEnv()
  const connected = socialConnected(env)
  const print = (rows: (SocialPostSlot & { status?: string })[], timeZone: string) => {
    if (rows.length === 0) console.log('Nothing ahead.')
    for (const row of rows) {
      console.log(
        previewSocialPost(row, {
          timeZone,
          tiktokMode: env.TIKTOK_POST_MODE,
          connected: connected[row.platform],
        }),
      )
      console.log('')
    }
  }

  // Reading a file and printing it needs no database at all.
  let fileSlots: SocialPostSlot[] | null = null
  if (command === 'import') {
    const path = process.argv[3]
    if (!path || path.startsWith('--'))
      throw new Error('usage: import <calendar.json> --start YYYY-MM-DD')
    const calendar = socialCalendarSchema.parse(JSON.parse(await readFile(path, 'utf8')))
    const start = arg('start') ?? calendar.startDate
    if (!start) throw new Error('The calendar has no startDate: give --start YYYY-MM-DD')
    fileSlots = calendarSlots(calendar, start, platformsArg())
    if (dry) {
      console.log(`Calendar v${calendar.version}, day 0 = ${start}. Nothing is written.\n`)
      print(firstDays(fileSlots, next, new Date()), calendar.timezone)
      return
    }
  }

  const dbName = arg('db') ?? env.MONGODB_DB
  const { db, close } = await connectToDatabase(env.MONGODB_URI, dbName)
  try {
    if (dry && command === undefined) {
      print(await nextSocialPosts(db, next), DEFAULT_ZONE)
      return
    }

    if (!dbName.endsWith('_dev') && !flag('confirm')) {
      throw new Error(
        `Refusing to write to "${dbName}" without --confirm. Run it with --dry first to see what it would do.`,
      )
    }

    if (command === 'import' && fileSlots) {
      const result = await importSocialSlots(db, fileSlots)
      console.log(
        `Imported into ${dbName}: ${result.inserted} new, ${result.updated} drafts updated, ` +
          `${result.unapproved} approved rows changed and put back to draft, ${result.kept} kept.`,
      )
      return
    }

    const version = intArg('version') ?? (await latestSocialCalendarVersion(db))
    if (version === null) throw new Error('No calendar has been imported yet')
    const offset = intArg('offset')
    const platform = platformArg()
    const filter = {
      calendarVersion: version,
      ...(offset !== undefined ? { dayOffset: offset } : {}),
      ...(platform ? { platform } : {}),
    }

    switch (command) {
      case 'approve': {
        const result = await approveSocialPosts(db, filter, 'script')
        console.log(`Approved ${result.approved} rows of calendar v${version}.`)
        if (result.heldForNativeCheck.length > 0) {
          console.log(
            `Still drafts, waiting for a native check — approve each with --offset N once read, ` +
              `or use its English alternate: offsets ${result.heldForNativeCheck.join(', ')}.`,
          )
        }
        break
      }
      case 'alternate': {
        if (offset === undefined) throw new Error('usage: alternate --offset N')
        console.log(
          `Swapped ${await useSocialAlternate(db, filter)} rows to the English alternate.`,
        )
        break
      }
      case 'skip': {
        if (offset === undefined) throw new Error('usage: skip --offset N [--platform p]')
        console.log(`Skipped ${await skipSocialPosts(db, filter)} rows.`)
        break
      }
      default:
        console.log(
          'Commands: import <file> --start YYYY-MM-DD | approve | alternate --offset N | ' +
            'skip --offset N | --dry [--next N]',
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
