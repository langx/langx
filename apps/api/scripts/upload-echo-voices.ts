/**
 * Puts the synthesised readings in this environment's bucket.
 *
 * **It writes bytes and nothing else.** The pack files already name every
 * reading, by a key `packVoiceKey` derives from the pack and the index — so
 * there is nothing for this script to record, and running it against a second
 * environment does not produce a second version of the content. That is the
 * whole reason the file holds a key rather than a URL: `content/echo/` is the
 * same in dev and in production, and only the bucket differs.
 *
 * `tools/echo-content/tts/generate.py` makes the audio and writes the keys.
 * This is the half that needs credentials, which is why the two are apart.
 *
 * Usage:
 *   pnpm exec tsx scripts/upload-echo-voices.ts --dir ../../tools/echo-content/tts/out
 *   pnpm exec tsx --env-file=../../.env scripts/upload-echo-voices.ts --dir <dir> --apply
 */
import { readFile } from 'node:fs/promises'
import { readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { echoPackFileSchema, packVoiceKey } from '@langx/shared'
import { loadEnv } from '../src/env'
import { createStorageProvider } from '../src/storage/createStorageProvider'
import type { StorageProviderWithPut } from '../src/storage/StorageProvider'

const CONTENT_ROOT = resolve(import.meta.dirname, '../../../content/echo')

async function packFiles(): Promise<string[]> {
  const found: string[] = []
  for (const entry of await readdir(CONTENT_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = join(CONTENT_ROOT, entry.name)
    for (const file of await readdir(dir)) {
      if (file.endsWith('.json')) found.push(join(dir, file))
    }
  }
  return found.sort()
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const dirIndex = process.argv.indexOf('--dir')
  const dir = dirIndex < 0 ? undefined : process.argv[dirIndex + 1]
  if (!dir) throw new Error('--dir <generated audio> is required')
  const root = resolve(dir)

  const storage = apply
    ? (createStorageProvider(loadEnv(process.env)) as StorageProviderWithPut)
    : null
  if (apply && typeof storage?.putObject !== 'function') {
    throw new Error('Storage is not configured — see .env.example')
  }

  let uploaded = 0
  let missing = 0
  for (const path of await packFiles()) {
    const pack = echoPackFileSchema.parse(JSON.parse(await readFile(path, 'utf8')))
    const takes = pack.items.flatMap((item) =>
      (item.voices ?? []).map((take) => ({ index: item.index, voice: take.voice, key: take.key })),
    )
    if (takes.length === 0) {
      console.log(`  ${pack.id}: no readings`)
      continue
    }

    for (const take of takes) {
      // The key the file claims has to be the one this pack and index derive,
      // or the upload would put the bytes somewhere the card never looks.
      const expected = packVoiceKey(pack.id, take.index, take.voice)
      if (take.key !== expected)
        throw new Error(`${pack.id}#${take.index}: ${take.key} is not ${expected}`)

      const source = join(root, pack.id.replace(':', '_'), `${take.index}-${take.voice}.m4a`)
      let body: Buffer
      try {
        body = await readFile(source)
      } catch {
        missing += 1
        continue
      }
      if (apply) await storage!.putObject(take.key, body, 'audio/mp4')
      uploaded += 1
    }
    console.log(`  ${pack.id}: ${takes.length} readings`)
  }

  if (missing > 0)
    console.log(`  ${missing} named by a pack and not generated — re-run generate.py`)
  console.log(apply ? `Done. ${uploaded} uploaded.` : `Dry run. ${uploaded} would upload.`)
}

void main()
