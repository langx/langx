/**
 * Fills `echoPacks` and `echoPackItems` from `content/echo/<lang>/<level>.json`.
 *
 * The content is CC BY-SA 4.0 and is **not** under this repository's licence —
 * see `content/echo/LICENSE`, and `ATTRIBUTION.md` beside it for where each
 * pack came from.
 *
 * **It refuses a file that has not been read by a person.** A pack drafted by
 * `tools/echo-content/build-pack.mjs` carries `"reviewed": false`, and this
 * script will not write it. That is the whole quality gate, and it is here
 * rather than in the pipeline because this is the last thing that runs before
 * the content reaches somebody learning from it: picking the right sense
 * mechanically does not work, and a wrong gloss is worse than no pack.
 *
 * **Idempotent.** Items are upserted by `<packId>#<index>`, which is the id a
 * card's `sourceKey` already points at, so a re-seed corrects the content
 * without moving anybody's schedule. Items the file no longer has are deleted;
 * the cards made from them are deliberately left alone, because a card is a
 * copy and belongs to the person who made it.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx scripts/seed-echo-packs.ts                    # dry run, every pack
 *   pnpm --filter @langx/api exec tsx scripts/seed-echo-packs.ts --apply
 *   pnpm --filter @langx/api exec tsx scripts/seed-echo-packs.ts --file ../../content/echo/fr/absoluteBeginner.json --apply
 */
import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { echoPackFileSchema, packImageKey, SUPPORTED_LOCALES, type Locale } from '@langx/shared'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import { packItemId, type EchoPackDoc, type EchoPackItemDoc } from '../src/modules/echo/packs'

const CONTENT_ROOT = resolve(import.meta.dirname, '../../../content/echo')
async function packFiles(explicit: string | undefined): Promise<string[]> {
  if (explicit) return [resolve(explicit)]
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

interface Draft {
  path: string
  pack: EchoPackDoc
  items: EchoPackItemDoc[]
  /**
   * Whether the *file* names media, which is not the same question as whether
   * the draft carries any: a reading and a cue are both dropped when there is
   * no bucket to resolve them against, so asking the mapped items would always
   * answer no in exactly the case the check below exists to catch.
   */
  needsMedia: boolean
}

async function readPack(path: string, mediaBaseUrl?: string): Promise<Draft | null> {
  const raw: unknown = JSON.parse(await readFile(path, 'utf8'))
  if (
    typeof raw === 'object' &&
    raw !== null &&
    (raw as { reviewed?: unknown }).reviewed !== true
  ) {
    console.log(`  skipped (reviewed: false) ${path}`)
    return null
  }

  const parsed = echoPackFileSchema.safeParse(raw)
  if (!parsed.success) {
    // The path as well as the message: "expected string, received undefined"
    // is useless without knowing which field, and a pack has hundreds.
    for (const issue of parsed.error.issues.slice(0, 5)) {
      console.error(`  malformed ${path}: ${issue.path.join('.')} — ${issue.message}`)
    }
    return null
  }
  const file = parsed.data

  // Which locales the pack can actually write a back in — derived from the
  // items rather than declared, so it cannot claim a column it does not have.
  const glossLocales = SUPPORTED_LOCALES.filter((locale: Locale) =>
    file.items.some((item) => item.gloss[locale]),
  )

  return {
    path,
    needsMedia: file.items.some((item) => item.voices?.length || item.image),
    pack: {
      _id: file.id,
      lang: file.lang,
      level: file.level,
      ...(file.hsk ? { hsk: file.hsk } : {}),
      itemCount: file.items.length,
      contentVersion: file.contentVersion,
      glossLocales: [...glossLocales],
      updatedAt: new Date(),
    },
    items: file.items.map((item) => ({
      _id: packItemId(file.id, item.index),
      packId: file.id,
      index: item.index,
      kind: item.kind,
      text: item.text,
      ...(item.reading ? { reading: item.reading } : {}),
      gloss: item.gloss,
      ...(item.example ? { example: item.example } : {}),
      ...(item.freqRank ? { freqRank: item.freqRank } : {}),
      // A cue becomes a URL here for the same reason a reading does, one line
      // down: the content names a slug so that `content/echo/` is the same in
      // every environment, and everything downstream carries a URL.
      ...(item.image && mediaBaseUrl
        ? {
            image: `${mediaBaseUrl.replace(/\/+$/, '')}/${packImageKey(item.image.slice('cue:'.length))}`,
          }
        : {}),
      ...(item.audio ? { audio: item.audio } : {}),
      /*
       * The key becomes a URL here, and only here. The pack file records a key
       * so that `content/echo/` is the same in every environment; a card and
       * everything downstream of it carries a URL, like all other media.
       */
      ...(item.voices?.length && mediaBaseUrl
        ? {
            voices: item.voices.map((take) => ({
              url: `${mediaBaseUrl.replace(/\/+$/, '')}/${take.key}`,
              voice: take.voice,
            })),
          }
        : {}),
      contentVersion: file.contentVersion,
    })),
  }
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const fileIndex = process.argv.indexOf('--file')
  const explicit = fileIndex < 0 ? undefined : process.argv[fileIndex + 1]

  // Read before the loop when applying, because a pack with readings needs the
  // bucket's public base to turn its keys into something playable.
  const env = apply ? loadEnv(process.env) : undefined
  const drafts: Draft[] = []
  for (const path of await packFiles(explicit)) {
    const draft = await readPack(path, env?.STORAGE_PUBLIC_BASE_URL)
    if (draft) drafts.push(draft)
  }

  if (drafts.length === 0) {
    console.log('Nothing to seed. A drafted pack needs `"reviewed": true` before it counts.')
    return
  }

  for (const draft of drafts) {
    console.log(`${draft.pack._id}: ${draft.items.length} items (${draft.path})`)
  }

  // A dry run reads files and nothing else — no database, no env. It is the
  // form somebody runs to see what a pack would write before they have a
  // connection string in front of them.
  if (!apply) {
    console.log('Dry run. Pass --apply to write.')
    return
  }

  /*
   * Refused rather than seeded silently. A pack whose readings resolved to
   * nothing looks finished — the cards are there, the audio button simply
   * never appears — and nothing downstream can tell that apart from a pack
   * that never had any. A pack whose cues resolved to nothing is the same
   * failure with a different button, so it is the same refusal.
   */
  if (!env!.STORAGE_PUBLIC_BASE_URL && drafts.some((draft) => draft.needsMedia)) {
    throw new Error('STORAGE_PUBLIC_BASE_URL is unset, and these packs have readings or cues')
  }

  const handle = await connectToDatabase(env!.MONGODB_URI, env!.MONGODB_DB)
  try {
    for (const draft of drafts) {
      await handle.db
        .collection<EchoPackDoc>(COLLECTIONS.echoPacks)
        .replaceOne({ _id: draft.pack._id }, draft.pack, { upsert: true })
      await handle.db.collection<EchoPackItemDoc>(COLLECTIONS.echoPackItems).bulkWrite(
        draft.items.map((item) => ({
          replaceOne: { filter: { _id: item._id }, replacement: item, upsert: true },
        })),
      )
      // Items the file dropped. The cards made from them stay: a card is a
      // copy, and it belongs to whoever made it.
      const removed = await handle.db
        .collection<EchoPackItemDoc>(COLLECTIONS.echoPackItems)
        .deleteMany({ packId: draft.pack._id, index: { $gte: draft.items.length } })
      if (removed.deletedCount > 0) console.log(`  removed ${removed.deletedCount} stale items`)
    }
  } finally {
    await handle.close()
  }

  console.log('Done.')
}

void main()
