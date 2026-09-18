import { createHash } from 'node:crypto'
import { MongoServerError, type Db } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import type { StorageProviderWithPut } from '../../storage/StorageProvider'
import type { TtsProvider } from '../../tts/TtsProvider'

/**
 * A sentence the voice service has already read, so the next caller holding it
 * is served the file instead of waking the machine. The `_id` is the storage
 * key, which is derived from the text — see `voiceKey`.
 */
export interface VoiceCacheDoc {
  _id: string
  url: string
  createdAt: Date
}

/**
 * `echo/tts/<lang>/<voice>/<sha1 of the text>.m4a` — content-addressed so that
 * two people keeping "on y va demain ?" share one object, and so a retry after
 * a timed-out upload overwrites the same key rather than leaving a stray.
 * Under `echo/tts/`, not `echo/packs/`, because a pack's readings are content
 * we re-seed and these are made on demand for whoever asked.
 *
 * **The `echo/` prefix and the `echoVoiceCache` collection keep their names now
 * that chat reads through here too.** Renaming either would orphan every object
 * and every row already paid for: the key *is* the identity, so a rename is a
 * silent re-synthesis of the whole cache rather than a tidy-up. The prefix says
 * where this started, not who is allowed to use it.
 */
export function voiceKey(lang: string, voice: string, text: string): string {
  const hash = createHash('sha1').update(text).digest('hex')
  return `echo/tts/${lang}/${voice}/${hash}.m4a`
}

/** Storage key to public URL, for those of `keys` that have already been read. */
export async function lookupVoices(db: Db, keys: readonly string[]): Promise<Map<string, string>> {
  const rows = await db
    .collection<VoiceCacheDoc>(COLLECTIONS.echoVoiceCache)
    .find({ _id: { $in: [...keys] } })
    .toArray()
  return new Map(rows.map((row) => [row._id, row.url] as const))
}

/**
 * Read `input` aloud, store the bytes under `key`, remember the row, hand back
 * the URL. **Always synthesises** — whether a miss is worth paying for is the
 * caller's question, and the two callers answer it differently.
 *
 * Deliberately separate from `lookupVoices` rather than one `readAloud` that
 * does both: the lookup has to happen *before* the quota is charged, or a
 * sentence somebody else already had read costs the next person a unit for a
 * file we do not synthesise. That ordering is the most load-bearing thing in
 * `synthesiseCard` and it has a test; a combined function would hide it from
 * the next caller, who would then charge for a cache hit.
 */
export async function synthesiseInto(
  db: Db,
  storage: StorageProviderWithPut,
  tts: TtsProvider,
  key: string,
  input: { text: string; lang: string; voice: string },
): Promise<string> {
  const bytes = await tts.synthesize(input)
  const url = await storage.putObject(key, bytes, 'audio/mp4')
  try {
    await db
      .collection<VoiceCacheDoc>(COLLECTIONS.echoVoiceCache)
      .insertOne({ _id: key, url, createdAt: new Date() })
  } catch (caught) {
    // Two callers with the same sentence read at once; both wrote the same
    // bytes under the same key, and the row is the same either way.
    if (!(caught instanceof MongoServerError) || caught.code !== 11000) throw caught
  }
  return url
}
