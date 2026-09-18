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
 * `cues.json` on Monday and seeded on Friday would be a broken image for four
 * days.
 *
 * Usage:
 *   pnpm exec tsx scripts/upload-echo-cues.ts
 *   pnpm exec tsx --env-file=../../.env scripts/upload-echo-cues.ts --apply
 */
import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { packImageKey } from '@langx/shared'
import { loadEnv } from '../src/env'
import { createStorageProvider } from '../src/storage/createStorageProvider'
import type { StorageProviderWithPut } from '../src/storage/StorageProvider'

const IMAGE_ROOT = resolve(import.meta.dirname, '../../../tools/echo-content/images/out')

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')

  const storage = apply
    ? (createStorageProvider(loadEnv(process.env)) as StorageProviderWithPut)
    : null
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
  for (const file of files) {
    const slug = file.replace(/\.png$/, '')
    const key = packImageKey(slug)
    if (!apply) {
      console.log(`  would upload ${key}`)
      continue
    }
    await storage!.putObject(key, await readFile(join(IMAGE_ROOT, file)), 'image/png')
    uploaded += 1
  }

  console.log(
    apply ? `Uploaded ${uploaded} cue(s).` : `${files.length} cue(s). Pass --apply to upload.`,
  )
}

await main()
