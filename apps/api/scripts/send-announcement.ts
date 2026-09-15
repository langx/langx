/**
 * Queues one message from @langx to everybody, as a message in their chat list.
 *
 * Not an email and not a push-only broadcast: an announcement lands in the
 * same thread the welcome did, so it is still there next week. The push is
 * only the knock on the door — `send-campaign.ts` is the tool for something
 * that has to arrive in an inbox, and it carries the consent rules and the
 * warm-up ramp that mail needs.
 *
 * **This no longer sends anything itself.** It writes a row to
 * `broadcastQueue` and the API works through it, half an hour at a time — so
 * the laptop does not have to stay awake, the send is paced, and it can be
 * stopped from the operator panel once it has started. The loop that used to
 * be here, and everything it knew about not messaging anybody twice, is in
 * `modules/admin/broadcastQueue.ts`.
 *
 * The body stays one file per locale in a directory, and each recipient gets
 * the one for their native language, falling back to `en.txt`. The panel can
 * write a broadcast too; this exists because an announcement in eight
 * languages is authored in files, reviewed in a diff, and not typed into a
 * textarea.
 *
 * A `<locale>.png` beside a body is uploaded and rides on the message as its
 * picture, with the body as the caption. Uploaded here rather than named by
 * URL, so that what goes out is the file that was reviewed — and into the
 * `broadcasts/` prefix, which belongs to nobody, because the message rows keep
 * pointing at it long after this script has exited.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx --env-file=../../.env \
 *     scripts/send-announcement.ts --id 2026-09-copilot --body announcements/copilot [--confirm]
 *
 * Without `--confirm` it writes the draft and stops there — which is a real
 * preview now rather than a printed one: the row is in the panel, where it can
 * be sent to yourself before it is armed. `--confirm` arms a draft that has
 * been; an untested one it refuses, because a file reviewed in a diff is not
 * the same thing as the message read in the app.
 */
import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { SUPPORTED_LOCALES, type Locale, type MessageMedia } from '@langx/shared'
import { connectToDatabase } from '../src/db/client'
import { loadEnv, publicApiUrl, type Env } from '../src/env'
import {
  createBroadcast,
  getBroadcast,
  isUntestedDraft,
  setBroadcastStatus,
} from '../src/modules/admin/broadcast'
import { ensureOfficialAccounts } from '../src/modules/official/accounts'
import { createStorageProvider } from '../src/storage/createStorageProvider'
import { supportsPut } from '../src/storage/StorageProvider'

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? undefined : process.argv[index + 1]
}

/** `<dir>/<locale>.txt`, or English. A missing English file is fatal. */
function loadBodies(dir: string): Record<string, string> {
  const bodies: Record<string, string> = {}
  for (const locale of SUPPORTED_LOCALES as readonly Locale[]) {
    const path = join(dir, `${locale}.txt`)
    if (existsSync(path)) bodies[locale] = readFileSync(path, 'utf8').trim()
  }
  if (!bodies.en) throw new Error(`${dir}/en.txt is required — it is the fallback`)
  return bodies
}

/**
 * A PNG's own idea of how big it is, read off the IHDR chunk.
 *
 * The client reserves the space before the bytes land, so a picture with no
 * dimensions on it jumps the thread when it arrives. Read rather than assumed:
 * the chart renderer draws 1200x675 today and the next announcement's picture
 * will be whatever somebody exported.
 */
function pngSize(bytes: Buffer): { width: number; height: number } {
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

/** `<dir>/<locale>.png`, uploaded — the ones that exist, in the locales they name. */
async function uploadImages(dir: string, env: Env): Promise<Record<string, MessageMedia>> {
  const files = (SUPPORTED_LOCALES as readonly Locale[])
    .map((locale) => ({ locale, path: join(dir, `${locale}.png`) }))
    .filter((file) => existsSync(file.path))
  if (files.length === 0) return {}

  const provider = createStorageProvider(env)
  // Refused rather than skipped: an announcement whose picture quietly did not
  // go is one nobody finds out about until it has been read by everybody.
  if (!supportsPut(provider)) {
    throw new Error(`${dir} has pictures but storage is not configured — set STORAGE_* in .env`)
  }

  const images: Record<string, MessageMedia> = {}
  for (const { locale, path } of files) {
    const bytes = readFileSync(path)
    const url = await provider.putObject(`broadcasts/${randomUUID()}.png`, bytes, 'image/png')
    images[locale] = {
      url,
      contentType: 'image/png',
      sizeBytes: bytes.byteLength,
      ...pngSize(bytes),
    }
  }
  return images
}

async function main(): Promise<void> {
  const slug = flag('id')
  const dir = flag('body')
  if (!slug || !dir) throw new Error('usage: --id <slug> --body <dir> [--confirm]')

  const env = loadEnv()
  const bodies = loadBodies(dir)
  const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)

  try {
    // Fills the id cache the queue reads. The API does this at boot; a script
    // is its own process and has had no boot.
    const accounts = await ensureOfficialAccounts(db, publicApiUrl(env))
    if (accounts.find((account) => account.handle === 'langx')?.outcome === 'conflict') {
      throw new Error('@langx is held by a real account — nothing to send from')
    }

    const existing = await getBroadcast(db, slug)
    /*
     * Uploaded only when the row is about to be written. Re-running this on a
     * draft that already exists must not put eight more copies in the bucket
     * for a job that will not be changed — and a `--confirm` run reaches here
     * with the files still on disk.
     */
    const images = existing ? {} : await uploadImages(dir, env)
    const job =
      existing ??
      (await createBroadcast(db, {
        id: slug,
        bodies,
        images,
        pushTitle: 'LangX',
        createdBy: 'script:send-announcement',
      }))

    console.log(`announcement ${slug} on ${env.MONGODB_DB}`)
    console.log(`  status:     ${job.status}${existing ? ' (already queued — left as it is)' : ''}`)
    console.log(`  recipients: ${job.total}`)
    console.log(`  locales:    ${Object.keys(job.bodies).join(', ')}`)
    console.log(`  pictures:   ${Object.keys(job.images ?? {}).join(', ') || 'none'}`)
    console.log(`\n  en.txt:\n${job.bodies.en?.slice(0, 300) ?? ''}\n`)

    if (!process.argv.includes('--confirm')) {
      console.log('(draft written — re-run with --confirm to arm it, or start it from the panel)')
      return
    }

    if (isUntestedDraft(job)) {
      console.log('(not armed — open it in the panel and send it to yourself first)')
      return
    }

    const armed = await setBroadcastStatus(db, slug, 'queued')
    console.log(
      armed
        ? `armed. The API sends it from here, in batches, inside its send window.`
        : `already past draft (${job.status}) — nothing to arm.`,
    )
  } finally {
    await close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
