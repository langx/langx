/**
 * Puts the cue pictures in this environment's bucket.
 *
 * **It writes bytes and nothing else**, exactly as `upload-echo-voices.ts`
 * does and for the same reason: the slug already decides the key, through
 * `packImageKey`, so there is nothing for this script to record and running it
 * against a second environment does not produce a second version of the
 * content.
 *
 * **The bucket is where these live.** They are not in the repository and are
 * not meant to be: twelve megabytes of regenerable PNG in a public repo buys
 * nothing that `build.mjs --apply` does not give back in a minute. So this
 * reads the render directory, and says so plainly when it is empty rather than
 * uploading nothing and reporting success.
 *
 * **Replacing a picture is not the same as adding one.** The key is the slug,
 * so a redrawn cue overwrites the object that was there — and in production
 * that object sits behind a CDN which has already cached it. New slugs appear
 * immediately; a redraw of an existing one needs its path purged, or it will
 * keep serving the old picture for as long as the cache holds it. Adding a
 * drawing for a concept that currently borrows a glyph is exactly this case.
 *
 * It uploads the whole directory rather than only the slugs the packs use.
 * The alternative — parse every pack, collect the cues, upload the
 * intersection — makes a picture's presence in the bucket depend on which
 * packs happened to be reviewed on the day somebody ran this. A cue added to
 * `cues.<lang>.json` on Monday and seeded on Friday would be a broken image for four
 * days.
 *
 * Usage:
 *   pnpm exec tsx scripts/upload-echo-cues.ts
 *   pnpm exec tsx --env-file=../../.env scripts/upload-echo-cues.ts --apply
 *   pnpm exec tsx --env-file=../../.env scripts/upload-echo-cues.ts --apply --purge
 */
import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { packImageKey } from '@langx/shared'
import { loadEnv } from '../src/env'
import { createStorageProvider } from '../src/storage/createStorageProvider'
import type { StorageProviderWithPut } from '../src/storage/StorageProvider'

const IMAGE_ROOT = resolve(import.meta.dirname, '../../../tools/echo-content/images/out')

/** Cloudflare takes at most thirty URLs per purge call. */
const PURGE_BATCH = 30

/**
 * Tells the CDN to forget the paths this run replaced.
 *
 * Read straight from `process.env` rather than through `loadEnv`, because
 * these belong to a person running a script and not to the API: adding them to
 * the schema would make the server demand credentials it never uses.
 *
 * A failure here is reported and does not stop the run. The bytes are in the
 * bucket either way, and the remedy — purge again, or wait out the cache — is
 * not worth losing the upload over.
 */
async function purge(urls: string[]): Promise<void> {
  const token = process.env.CLOUDFLARE_API_TOKEN
  const zone = process.env.CLOUDFLARE_ZONE_ID
  if (!token || !zone) {
    console.warn('  CLOUDFLARE_API_TOKEN or CLOUDFLARE_ZONE_ID is unset; nothing purged.')
    return
  }
  /*
   * A zone id is thirty-two hex characters and nothing else. Checked rather
   * than trusted, because it is about to become part of a URL this process
   * calls: a value with a slash or a host in it would send the token
   * somewhere other than Cloudflare. It also catches the likelier mistake —
   * an env var holding the account id, or a name, or a stray newline — before
   * the request rather than after it.
   */
  if (!/^[0-9a-f]{32}$/.test(zone)) {
    console.error('  CLOUDFLARE_ZONE_ID is not a zone id; nothing purged.')
    return
  }
  const endpoint = `https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`
  for (let at = 0; at < urls.length; at += PURGE_BATCH) {
    const batch = urls.slice(at, at + PURGE_BATCH)
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ files: batch }),
    })
    if (!response.ok) {
      console.error(`  purge failed (${response.status}): ${await response.text()}`)
      return
    }
  }
  console.log(`  Purged ${urls.length} path(s) from the CDN.`)
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const wantsPurge = process.argv.includes('--purge')

  const env = apply ? loadEnv(process.env) : undefined
  const storage = apply ? (createStorageProvider(env!) as StorageProviderWithPut) : null
  if (apply && typeof storage?.putObject !== 'function') {
    throw new Error('Storage is not configured — see .env.example')
  }

  const files = (await readdir(IMAGE_ROOT).catch(() => []))
    .filter((name) => name.endsWith('.png'))
    .sort()
  if (files.length === 0) {
    throw new Error('No cues rendered. Run tools/echo-content/images/build.mjs --apply first.')
  }

  let uploaded = 0
  const written: string[] = []
  for (const file of files) {
    const slug = file.replace(/\.png$/, '')
    const key = packImageKey(slug)
    if (!apply) {
      console.log(`  would upload ${key}`)
      continue
    }
    await storage!.putObject(key, await readFile(join(IMAGE_ROOT, file)), 'image/png')
    written.push(`${env!.STORAGE_PUBLIC_BASE_URL?.replace(/\/+$/, '') ?? ''}/${key}`)
    uploaded += 1
  }

  /*
   * Only worth doing where a CDN is in front of the bucket, and only for a
   * replacement — a new slug has nothing cached to forget. Asking for it
   * unconditionally would spend the zone's purge quota on the first upload of
   * every picture.
   */
  if (apply && wantsPurge) await purge(written)

  console.log(
    apply ? `Uploaded ${uploaded} cue(s).` : `${files.length} cue(s). Pass --apply to upload.`,
  )
}

await main()
