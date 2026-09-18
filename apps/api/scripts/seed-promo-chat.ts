/**
 * The conversation the promo video scrolls through, and the boosted strip
 * above it.
 *
 * `seed-test-chat.ts` already builds a long, realistic thread, but not this
 * one: a promo run wants something a viewer can take in while it scrolls past
 * in four seconds — short turns, a correction where the product's point is,
 * a voice note and a picture so the composer's affordances are visibly used.
 * It also wants a boosted strip with more than one card in it, and a boost is
 * a subscription, which no fixture account has.
 *
 * Everything it writes goes through the same module functions the app calls,
 * so a message here is a message: the same guards, the same token awards, the
 * same conversation row. Only the clock is faked, and only so the thread reads
 * as one sitting rather than as eighteen messages in the same second.
 *
 * Usage:
 *   cd apps/api && pnpm exec tsx --env-file=../../.env \
 *     scripts/seed-promo-chat.ts --db langx_dev
 *
 * Fixture accounts only: every handle it touches is a `test.langx.invalid`
 * address, and `resolveDbName` refuses a database not ending in `_dev`.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Db } from 'mongodb'
import { COLLECTIONS } from '../src/db/collections'
import { connectToDatabase } from '../src/db/client'
import { loadEnv, type Env } from '../src/env'
import { renderCard, type CardNode } from '../src/modules/cards/render'
import { sendMediaMessage, sendCorrection, sendTextMessage } from '../src/modules/chat/messages'
import { startConversation } from '../src/modules/chat/conversations'
import { createStorageProvider } from '../src/storage/createStorageProvider'
import { supportsPut } from '../src/storage/StorageProvider'
import { emailFor, resolveDbName } from './testAccounts'

type Side = 'george' | 'katya'

const VIEWER = 'test_george'
const PARTNER = 'test_katya'

/** Who gets a boost, so the strip has cards in it rather than one card. */
const BOOSTED = ['test_marina', 'test_anna', 'test_yuki', 'test_mateo']

interface Turn {
  from: Side
  body: string
  /** Names this turn, so a later one can correct it. */
  id?: string
  /** The turn this one corrects; that is what makes it a correction. */
  corrects?: string
  note?: string
  /** A voice note instead of text; `body` becomes what the voice says. */
  voice?: true
  /** A picture instead of text; `body` is the caption. */
  picture?: true
}

/**
 * Eighteen turns, short on purpose.
 *
 * The video scrolls this past in a few seconds, so nothing in it can need a
 * second read — and the two turns that matter are the correction and what
 * follows it, because that exchange is the whole product and the rest is
 * context for it.
 *
 * Why the voice note and the picture come so late in it: photos and voice
 * notes unlock only after five messages from the other person
 * (`assertMediaUnlocked`), which is a real rule about strangers and not
 * something a fixture may skip. Move either turn earlier and the seed stops
 * with MEDIA_LOCKED, correctly.
 */
const SCRIPT: Turn[] = [
  { from: 'george', body: 'Hi Katya! Want to trade Russian for English?' },
  { from: 'katya', body: 'Yes! I need someone who will not switch to English on me.' },
  { from: 'george', body: 'Deal. I switch to English the second I panic, so hold me to it.' },
  { from: 'katya', body: 'What are you stuck on?' },
  { from: 'george', id: 'cases', body: 'Cases. I have been four month learning them.' },
  {
    from: 'katya',
    corrects: 'cases',
    body: 'I have been learning them for four months.',
    note: 'Duration goes at the end with "for", and "month" needs the plural.',
  },
  { from: 'george', body: 'That is the one I get wrong every single time.' },
  { from: 'katya', body: 'Everyone does. Say it out loud twice and it sticks.' },
  { from: 'george', body: 'Fine. Out loud, no hiding.' },
  { from: 'katya', body: 'Go on then.' },
  { from: 'george', voice: true, body: 'I have been learning them for four months.' },
  { from: 'katya', body: 'Better. Your vowels are already good.' },
  { from: 'katya', body: 'Now the same sentence in Russian. I will be kind.' },
  { from: 'george', body: 'Ya uchu padezhi chetyre mesyatsa.' },
  { from: 'katya', body: 'Almost. The stress lands on the last syllable of padezhi.' },
  { from: 'george', body: 'Every language has one thing built to defeat me.' },
  { from: 'katya', picture: true, body: 'Drew you the six cases this morning.' },
  { from: 'george', body: 'This is going on my wall. Thank you.' },
  // Ends on Katya, deliberately: the capture's own message is the next turn,
  // and a thread that already ended on the viewer would make it a monologue.
  { from: 'katya', body: 'Same time tomorrow? Twenty minutes, Russian only.' },
]

async function userId(db: Db, handle: string): Promise<string> {
  const user = await db.collection(COLLECTIONS.user).findOne({ email: emailFor(handle) })
  if (!user) throw new Error(`no fixture account for @${handle} — run seed-test-users.ts first`)
  return String(user._id)
}

/** Clear the pair's thread, so re-running this script rebuilds rather than appends. */
async function clearConversation(db: Db, ids: string[]): Promise<void> {
  const conversations = await db
    .collection(COLLECTIONS.conversations)
    .find({ participants: { $all: ids } }, { projection: { _id: 1 } })
    .toArray()
  if (conversations.length === 0) return
  const conversationIds = conversations.map((conversation) => conversation._id)
  await db.collection(COLLECTIONS.messages).deleteMany({ conversationId: { $in: conversationIds } })
  await db.collection(COLLECTIONS.conversations).deleteMany({ _id: { $in: conversationIds } })
}

/**
 * A boost is a subscription, and no fixture account has one.
 *
 * Written straight onto the profile the way `create-review-account.ts` does:
 * `store: 'manual'` is what says this came from here rather than from a store,
 * and the first `POST /billing/refresh` from a real client would replace it —
 * which is correct, and never happens to an account nobody signs into.
 */
async function boost(db: Db, handles: string[]): Promise<number> {
  const now = new Date()
  let boosted = 0
  for (const handle of handles) {
    const id = await userId(db, handle)
    const result = await db
      .collection(COLLECTIONS.profiles)
      .updateOne(
        { _id: id as never },
        {
          $set: { entitlement: { tier: 'pro', willRenew: false, store: 'manual', updatedAt: now } },
        },
      )
    boosted += result.modifiedCount
  }
  return boosted
}

/** A voice note, spoken by the machine that is already on this Mac. */
function speak(text: string): { bytes: Uint8Array; seconds: number } | null {
  const scratch = mkdtempSync(join(tmpdir(), 'promo-voice-'))
  try {
    const aiff = join(scratch, 'note.aiff')
    const m4a = join(scratch, 'note.m4a')
    const said = spawnSync('say', ['-o', aiff, text])
    if (said.status !== 0) return null
    const converted = spawnSync(process.env.FFMPEG_PATH ?? 'ffmpeg', [
      '-v',
      'error',
      '-y',
      '-i',
      aiff,
      '-c:a',
      'aac',
      '-b:a',
      '64k',
      m4a,
    ])
    if (converted.status !== 0) return null
    const probe = spawnSync(process.env.FFPROBE_PATH ?? 'ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'csv=p=0',
      m4a,
    ])
    return {
      bytes: new Uint8Array(readFileSync(m4a)),
      seconds: Math.max(1, Math.round(Number(probe.stdout.toString().trim()) || 3)),
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
}

/**
 * The picture Katya sends: a drawing, because she is an illustrator and
 * because a photograph would have to come from somewhere. Drawn here with the
 * same renderer the share cards use, so it carries the app's own colours and
 * no claim about the world.
 */
async function drawing(): Promise<Uint8Array> {
  const el = (type: string, props: CardNode['props']): CardNode => ({ type, props })
  const CASES = [
    'именительный',
    'родительный',
    'дательный',
    'винительный',
    'творительный',
    'предложный',
  ]
  const card = el('div', {
    style: {
      width: '1080px',
      height: '1080px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      padding: '90px',
      backgroundColor: '#fffdf5',
      fontFamily: 'Nunito',
    },
    children: [
      el('div', {
        style: { fontSize: '64px', fontWeight: 800, color: '#17191c', marginBottom: '48px' },
        children: 'Шесть падежей',
      }),
      ...CASES.map((name, index) =>
        el('div', {
          style: { display: 'flex', alignItems: 'center', marginBottom: '26px' },
          children: [
            el('div', {
              style: {
                display: 'flex',
                width: '64px',
                height: '64px',
                borderRadius: '32px',
                backgroundColor: '#ffc409',
                color: '#201900',
                fontSize: '34px',
                fontWeight: 800,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '28px',
              },
              children: String(index + 1),
            }),
            el('div', {
              style: { fontSize: '44px', fontWeight: 600, color: '#17191c' },
              children: name,
            }),
          ],
        }),
      ),
    ],
  })
  return new Uint8Array(await renderCard(card, 'square'))
}

async function seed(db: Db, env: Env): Promise<void> {
  const ids: Record<Side, string> = {
    george: await userId(db, VIEWER),
    katya: await userId(db, PARTNER),
  }
  await clearConversation(db, [ids.george, ids.katya])

  const storage = createStorageProvider(env)
  const base = env.STORAGE_PUBLIC_BASE_URL
  const canUpload = supportsPut(storage) && base !== undefined

  // Two minutes apart, ending now: one sitting, in the right order.
  const startedAt = Date.now() - SCRIPT.length * 2 * 60 * 1000
  const byTurnId = new Map<string, string>()
  let conversationId: string | undefined
  let media = 0

  for (const [index, turn] of SCRIPT.entries()) {
    const at = new Date(startedAt + index * 2 * 60 * 1000)

    if (!conversationId) {
      const started = await startConversation(db, ids[turn.from], {
        toUserId: ids[turn.from === 'george' ? 'katya' : 'george'],
        body: turn.body,
      })
      conversationId = started.conversation._id.toHexString()
      if (turn.id) byTurnId.set(turn.id, started.message._id.toHexString())
      await stamp(db, started.message._id.toHexString(), at)
      continue
    }

    if (turn.corrects) {
      const target = byTurnId.get(turn.corrects)
      if (!target) throw new Error(`correction points at unknown turn "${turn.corrects}"`)
      const sent = await sendCorrection(db, ids[turn.from], {
        conversationId,
        targetMessageId: target,
        corrected: turn.body,
        ...(turn.note !== undefined ? { note: turn.note } : {}),
      })
      await stamp(db, sent.message._id.toHexString(), at)
      continue
    }

    if ((turn.voice || turn.picture) && canUpload) {
      const attachment = turn.voice ? speak(turn.body) : { bytes: await drawing(), seconds: 0 }
      if (attachment) {
        const isVoice = turn.voice === true
        const key = `messages/${conversationId}/promo-${index}.${isVoice ? 'm4a' : 'png'}`
        const contentType = isVoice ? 'audio/mp4' : 'image/png'
        const url = await storage.putObject(key, attachment.bytes, contentType)
        const sent = await sendMediaMessage(
          db,
          ids[turn.from],
          {
            conversationId,
            attachments: [
              {
                url,
                contentType,
                sizeBytes: attachment.bytes.byteLength,
                ...(isVoice
                  ? { durationSeconds: attachment.seconds }
                  : { width: 1080, height: 1080 }),
              },
            ],
            ...(turn.picture ? { body: turn.body } : {}),
          },
          base,
        )
        await stamp(db, sent.message._id.toHexString(), at)
        media += 1
        continue
      }
    }

    const sent = await sendTextMessage(db, ids[turn.from], { conversationId, body: turn.body })
    if (turn.id) byTurnId.set(turn.id, sent.message._id.toHexString())
    await stamp(db, sent.message._id.toHexString(), at)
  }

  const boosted = await boost(db, BOOSTED)
  console.log(`${SCRIPT.length} messages (${media} with media), ${boosted} profile(s) boosted`)
  if (!canUpload)
    console.log('storage not configured — the voice note and the picture were skipped')
}

/**
 * Backdate one message.
 *
 * The send functions stamp `new Date()` and should: they are the app's, not
 * this script's. Eighteen messages all at 21:04 read as a bug, so the row is
 * moved afterwards rather than the clock being passed in.
 */
async function stamp(db: Db, messageId: string, at: Date): Promise<void> {
  await db
    .collection(COLLECTIONS.messages)
    .updateOne({ _id: messageId as never }, { $set: { createdAt: at } })
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const env = loadEnv()
  const dbName = resolveDbName(args, env.MONGODB_DB)
  const { db, close } = await connectToDatabase(env.MONGODB_URI, dbName)
  console.log(`database: ${dbName}`)
  try {
    await seed(db, env)
  } finally {
    await close()
  }
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
