/**
 * ETL — chat history step.
 *
 * Reads v1's rooms and messages and stages them in `legacyRooms` /
 * `legacyMessages`, copying every shared photo and voice note out of
 * Appwrite Storage into our own bucket on the way.
 *
 * **Nothing here writes a real conversation.** A v1 thread is two people's
 * words, and importing it because one of them came back would republish the
 * other's messages into an account they never opened. So a thread waits in
 * staging until *both* participants have restored, and
 * `importLegacyConversations` moves it across at that moment — see that module
 * for the rule. This script's job is only to make sure the data is still here
 * when that moment arrives.
 *
 * Which is why the media is copied **now** rather than lazily at import time:
 * v1's Appwrite is being switched off, and this run is the last time those
 * files can be read at all. A lazy fetch would work perfectly right up until
 * the day it silently didn't, and by then the originals would be gone.
 *
 * Rooms where **neither** participant was staged by `migrate-profiles.ts` are
 * skipped outright — a thread that can never satisfy the both-sides rule is
 * not worth the bytes. Rooms with one stageable side are kept: that person may
 * come back, and their partner may follow.
 *
 * **Idempotent.** Rooms and messages are upserted on their v1 document ids, a
 * room already imported into a live conversation is never touched again, and
 * media is only fetched when the staged record does not already have it — so a
 * re-run after a failure costs the remainder, not the whole thing.
 *
 * Usage:
 *   pnpm --filter @langx/api exec tsx scripts/migrate-messages.ts               # dry run
 *   pnpm --filter @langx/api exec tsx scripts/migrate-messages.ts --apply
 *   pnpm --filter @langx/api exec tsx scripts/migrate-messages.ts --apply --skip-media
 *   pnpm --filter @langx/api exec tsx scripts/migrate-messages.ts --limit 25    # try a slice first
 */
import { MAX_AUDIO_BYTES, MAX_IMAGE_BYTES, type MessageMedia } from '@langx/shared'
import { Client, Databases, Query, Storage } from 'node-appwrite'
import { connectToDatabase } from '../src/db/client'
import { COLLECTIONS } from '../src/db/collections'
import { loadEnv } from '../src/env'
import type { LegacyMessage, LegacyRoom } from '../src/modules/handles/legacyConversations'
import type { LegacyProfile } from '../src/modules/handles/legacyProfiles'
import { createStorageProvider } from '../src/storage/createStorageProvider'
import { supportsPut, type StorageProviderWithPut } from '../src/storage/StorageProvider'
import { imageDimensions } from '../src/lib/imageDimensions'
import { isServableLegacyMedia, normalizeLegacyContentType } from '../src/lib/legacyMedia'

const DATABASE_ID = '650750f16cd0c482bb83'
const ROOMS_COLLECTION = '6507510fc71f989d5d1c'
const MESSAGES_COLLECTION = '65075108a4025a4f5bd7'
/** v1 kept chat attachments in two buckets, split by kind. */
const MESSAGE_BUCKET = '655fedc46d24b615878a'
const AUDIO_BUCKET = '6563aa2ef2cd2964cf27'
const PAGE_SIZE = 100

interface V1Room {
  $id: string
  users?: unknown
  lastMessageUpdatedAt?: unknown
}

interface V1Message {
  $id: string
  $createdAt: string
  sender?: unknown
  roomId?: unknown
  type?: unknown
  body?: unknown
  seen?: unknown
  deleted?: unknown
  imageId?: unknown
  audioId?: unknown
}

interface Summary {
  roomsSeen: number
  roomsSkippedNoStagedUser: number
  roomsSkippedImported: number
  roomsStaged: number
  roomsBothSidesStaged: number
  messagesStaged: number
  messagesSkippedDeleted: number
  messagesSkippedEmpty: number
  imagesCopied: number
  audioCopied: number
  mediaFailures: number
  mediaTooLarge: number
  mediaUnsupported: number
}

async function* fetchRooms(databases: Databases, limit: number): AsyncGenerator<V1Room> {
  let cursor: string | undefined
  let yielded = 0
  for (;;) {
    const queries = [Query.limit(PAGE_SIZE)]
    if (cursor) queries.push(Query.cursorAfter(cursor))
    const page = await databases.listDocuments({
      databaseId: DATABASE_ID,
      collectionId: ROOMS_COLLECTION,
      queries,
    })
    for (const doc of page.documents) {
      yield doc
      if (++yielded >= limit) return
    }
    if (page.documents.length < PAGE_SIZE) break
    cursor = page.documents.at(-1)?.$id
  }
}

/** Every message in one room, oldest first. Paged — some v1 threads are long. */
async function* fetchMessages(databases: Databases, roomId: string): AsyncGenerator<V1Message> {
  let cursor: string | undefined
  for (;;) {
    const queries = [
      Query.equal('roomId', roomId),
      Query.orderAsc('$createdAt'),
      Query.limit(PAGE_SIZE),
    ]
    if (cursor) queries.push(Query.cursorAfter(cursor))
    const page = await databases.listDocuments({
      databaseId: DATABASE_ID,
      collectionId: MESSAGES_COLLECTION,
      queries,
    })
    for (const doc of page.documents) yield doc
    if (page.documents.length < PAGE_SIZE) break
    cursor = page.documents.at(-1)?.$id
  }
}

/**
 * v1's own three types. `body` is the text one; the enum's member name is
 * unhelpful but it is what the documents actually carry.
 */
function toMessageType(value: unknown): LegacyMessage['type'] | null {
  if (value === 'body') return 'text'
  if (value === 'image') return 'image'
  if (value === 'audio') return 'audio'
  return null
}

function twoUsers(value: unknown): [string, string] | null {
  if (!Array.isArray(value)) return null
  const ids = value.filter((id): id is string => typeof id === 'string' && id.length > 0)
  const unique = [...new Set(ids)]
  return unique.length === 2 ? [unique[0]!, unique[1]!] : null
}

/**
 * Copies one attachment into our bucket and describes it the way a v2 message
 * expects. Returns `null` when the file is unusable — a type v2 will not serve,
 * or larger than the ceiling the live upload path enforces. Letting either
 * through would stage a message the client cannot render.
 */
async function copyAttachment(
  storage: Storage,
  provider: StorageProviderWithPut,
  bucketId: string,
  fileId: string,
  kind: 'image' | 'audio',
  key: string,
  summary: Summary,
): Promise<MessageMedia | null> {
  const file = await storage.getFile({ bucketId, fileId })
  // v1's own name for the type, translated — its voice notes all report
  // `audio/x-hx-aac-adts`, which no allowlist in v2 contains. See
  // `lib/legacyMedia.ts`; taking it at face value skips every voice message.
  const contentType = normalizeLegacyContentType(file.mimeType)
  if (!isServableLegacyMedia(contentType, kind)) {
    summary.mediaUnsupported++
    return null
  }

  const ceiling = kind === 'image' ? MAX_IMAGE_BYTES : MAX_AUDIO_BYTES
  if (file.sizeOriginal > ceiling) {
    summary.mediaTooLarge++
    return null
  }

  const bytes = new Uint8Array(await storage.getFileDownload({ bucketId, fileId }))
  const extension = contentType.split('/')[1]?.split('+')[0] ?? (kind === 'image' ? 'jpg' : 'm4a')
  const url = await provider.putObject(`${key}.${extension}`, bytes, contentType)

  const media: MessageMedia = { url, contentType, sizeBytes: bytes.byteLength }
  if (kind === 'image') {
    // Read out of the file header rather than left blank. `ImageBubble` falls
    // back to measuring on load, but without this every migrated photo would
    // reflow the list the first time it is scrolled past.
    const size = imageDimensions(bytes)
    if (size) {
      media.width = size.width
      media.height = size.height
    }
  }
  // No duration for audio: v1 never stored one, and the player reports it
  // once the file loads. Guessing it from the byte length would be wrong for
  // every variable-bitrate recording.
  return media
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply')
  const skipMedia = process.argv.includes('--skip-media')
  const limitIndex = process.argv.indexOf('--limit')
  const limit = limitIndex >= 0 ? Number(process.argv[limitIndex + 1]) : Number.POSITIVE_INFINITY

  const env = loadEnv()
  if (!env.APPWRITE_ENDPOINT || !env.APPWRITE_PROJECT_ID || !env.APPWRITE_API_KEY) {
    throw new Error('APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID and APPWRITE_API_KEY are required')
  }

  const storageProvider = createStorageProvider(env)
  const canCopyMedia = supportsPut(storageProvider)
  if (!skipMedia && !canCopyMedia) {
    // Loud, because the alternative is staging every thread with its photos
    // and voice notes silently missing and calling that a migration — and by
    // the time anyone notices, v1's bucket may be gone.
    throw new Error(
      'Storage is not configured, so shared photos and voice notes cannot be copied. ' +
        'Set STORAGE_* in .env, or re-run with --skip-media to stage text messages only.',
    )
  }

  const client = new Client()
    .setEndpoint(env.APPWRITE_ENDPOINT)
    .setProject(env.APPWRITE_PROJECT_ID)
    .setKey(env.APPWRITE_API_KEY)
  const databases = new Databases(client)
  const storage = new Storage(client)

  const { db, close } = await connectToDatabase(env.MONGODB_URI, env.MONGODB_DB)
  const legacyRooms = db.collection<LegacyRoom>(COLLECTIONS.legacyRooms)
  const legacyMessages = db.collection<LegacyMessage>(COLLECTIONS.legacyMessages)

  console.log('Loading staged v1 profiles…')
  const stagedIds = new Set(
    (
      await db
        .collection<LegacyProfile>(COLLECTIONS.legacyProfiles)
        .find({}, { projection: { _id: 1 } })
        .toArray()
    ).map((row) => row._id),
  )
  console.log(`  ${stagedIds.size} profiles staged — run migrate-profiles.ts first if that is 0`)
  console.log(
    apply
      ? `Applying${skipMedia ? ' (text only, media skipped)' : ' with media copy'}…`
      : 'Dry run — no writes, no uploads…',
  )

  const summary: Summary = {
    roomsSeen: 0,
    roomsSkippedNoStagedUser: 0,
    roomsSkippedImported: 0,
    roomsStaged: 0,
    roomsBothSidesStaged: 0,
    messagesStaged: 0,
    messagesSkippedDeleted: 0,
    messagesSkippedEmpty: 0,
    imagesCopied: 0,
    audioCopied: 0,
    mediaFailures: 0,
    mediaTooLarge: 0,
    mediaUnsupported: 0,
  }

  for await (const roomDoc of fetchRooms(databases, limit)) {
    summary.roomsSeen++

    const participants = twoUsers(roomDoc.users)
    if (!participants) continue

    // A thread neither of whose people was staged can never meet the
    // both-sides rule, so copying its attachments would be pure cost.
    const staged = participants.filter((id) => stagedIds.has(id))
    if (staged.length === 0) {
      summary.roomsSkippedNoStagedUser++
      continue
    }
    if (staged.length === 2) summary.roomsBothSidesStaged++

    const existingRoom = await legacyRooms.findOne({ _id: roomDoc.$id })
    if (existingRoom?.importedAt) {
      // Live conversation now. Re-staging would do nothing (the messages are
      // already keyed by their v1 ids) but it would re-fetch media for a room
      // nobody will read again.
      summary.roomsSkippedImported++
      continue
    }

    const counts = { text: 0, image: 0, audio: 0 }
    let lastMessageAt: Date | undefined
    const pending: LegacyMessage[] = []

    for await (const messageDoc of fetchMessages(databases, roomDoc.$id)) {
      if (messageDoc.deleted === true) {
        // Deleted in v1 means deleted. Bringing it back would undo something
        // the sender explicitly chose.
        summary.messagesSkippedDeleted++
        continue
      }
      const type = toMessageType(messageDoc.type)
      if (!type) continue
      const senderId = typeof messageDoc.sender === 'string' ? messageDoc.sender : null
      if (!senderId || !participants.includes(senderId)) continue

      const body = typeof messageDoc.body === 'string' ? messageDoc.body.trim() : ''
      const createdAt = new Date(messageDoc.$createdAt)

      const record: LegacyMessage = {
        _id: messageDoc.$id,
        roomId: roomDoc.$id,
        senderId,
        type,
        body,
        seen: messageDoc.seen === true,
        createdAt,
      }

      if (type !== 'text') {
        const existing = await legacyMessages.findOne({ _id: messageDoc.$id })
        if (existing?.media) {
          // Already copied by an earlier run — do not pay for it twice.
          record.media = existing.media
        } else if (apply && !skipMedia && canCopyMedia) {
          const fileId = type === 'image' ? messageDoc.imageId : messageDoc.audioId
          if (typeof fileId === 'string' && fileId) {
            try {
              const media = await copyAttachment(
                storage,
                storageProvider,
                type === 'image' ? MESSAGE_BUCKET : AUDIO_BUCKET,
                fileId,
                type,
                `legacy/rooms/${roomDoc.$id}/${messageDoc.$id}`,
                summary,
              )
              if (media) {
                record.media = media
                if (type === 'image') summary.imagesCopied++
                else summary.audioCopied++
              }
            } catch {
              summary.mediaFailures++
            }
          }
        }

        if (!record.media && !record.body) {
          // An attachment whose bytes did not come across and that carried no
          // caption is an empty bubble. Leaving it out means the thread has a
          // gap; keeping it means the thread has a broken tile. A gap is
          // quieter, and a re-run can still fill it in later.
          summary.messagesSkippedEmpty++
          continue
        }
      } else if (!body) {
        summary.messagesSkippedEmpty++
        continue
      }

      counts[type]++
      lastMessageAt = createdAt
      pending.push(record)
      summary.messagesStaged++
    }

    if (pending.length === 0) continue

    const room: LegacyRoom = {
      _id: roomDoc.$id,
      participants,
      counts,
      migratedAt: new Date(),
    }
    if (lastMessageAt) room.lastMessageAt = lastMessageAt

    summary.roomsStaged++
    if (!apply) continue

    await legacyMessages.bulkWrite(
      pending.map((record) => ({
        updateOne: { filter: { _id: record._id }, update: { $set: record }, upsert: true },
      })),
      { ordered: false },
    )
    // Never `$set`s `importedAt` — that flag belongs to the v2 side and this
    // script must not be able to un-import a thread someone is now reading.
    await legacyRooms.updateOne({ _id: room._id }, { $set: room }, { upsert: true })
  }

  console.log('\n=== Summary ===')
  console.log(`Rooms seen:                        ${summary.roomsSeen}`)
  console.log(`  neither user staged (skipped):   ${summary.roomsSkippedNoStagedUser}`)
  console.log(`  already imported (skipped):      ${summary.roomsSkippedImported}`)
  console.log(`Rooms staged:                      ${summary.roomsStaged}`)
  console.log(`  ...both sides staged:            ${summary.roomsBothSidesStaged}`)
  console.log(`Messages staged:                   ${summary.messagesStaged}`)
  console.log(`  text/image/audio breakdown is per room in legacyRooms.counts`)
  console.log(`Messages skipped (deleted in v1):  ${summary.messagesSkippedDeleted}`)
  console.log(`Messages skipped (nothing to show):${summary.messagesSkippedEmpty}`)
  if (apply && !skipMedia) {
    console.log(`Images copied:                     ${summary.imagesCopied}`)
    console.log(`Voice notes copied:                ${summary.audioCopied}`)
    console.log(`Media over the size ceiling:       ${summary.mediaTooLarge}`)
    console.log(`Media of a type v2 cannot serve:   ${summary.mediaUnsupported}`)
    console.log(`Media failures:                    ${summary.mediaFailures}`)
  }
  if (!apply) console.log('\n(dry run — re-run with --apply to write)')

  await close()
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
