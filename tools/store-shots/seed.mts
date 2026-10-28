/**
 * The demo world the store screenshots are taken in: Sofia (@sofia) and her
 * partners, written into a throwaway database on the isolated stack.
 *
 *   cd apps/api && npx tsx ../../tools/store-shots/seed.mts <mongo-uri> <db>
 *
 * `run.mjs` calls this; it is not meant to be pointed at anything else. The
 * database name must end in `_dev` (the fixture guard in `testAccounts.ts`)
 * and the URI must be a loopback one, because the stack's in-memory replica
 * set is the only database this has any business writing to.
 *
 * Rows go in through the module functions wherever one exists — a thread is
 * `startConversation` + `sendTextMessage` + `sendCorrection`, a card is
 * `captureFromMessage` — so a screen shows real rows, not a picture of them.
 * What has no function (a streak's history, a balance earned over months) is
 * written the way those functions would have left it, then backdated.
 *
 * Partner ids are chosen, not random: the app colours a partner by a hash of
 * their id (`partnerHueFor`), and the shots keep Anna lilac, George tangerine
 * and Yuki mint. Picking the id is the only way to pick the hue.
 */
import { createRequire } from 'node:module'
import type * as AuthCrypto from 'better-auth/crypto'
import type * as Mongo from 'mongodb'
import type { OnboardingProfileInput } from '@langx/shared'
import { COLLECTIONS } from '../../apps/api/src/db/collections.ts'
import { connectToDatabase } from '../../apps/api/src/db/client.ts'
import { ensureIndexes } from '../../apps/api/src/db/indexes.ts'
import { startConversation } from '../../apps/api/src/modules/chat/conversations.ts'
import { sendCorrection, sendTextMessage } from '../../apps/api/src/modules/chat/messages.ts'
import { captureFromMessage } from '../../apps/api/src/modules/echo/cards.ts'
import { createProfile } from '../../apps/api/src/modules/profiles/profiles.ts'
import { awardTokens, readAggregates } from '../../apps/api/src/modules/tokens/ledger.ts'
import { PASSWORD, emailFor, resolveDbName } from '../../apps/api/scripts/testAccounts.ts'
import * as shared from '../../packages/shared/src/index.ts'
import { partnerHueFor } from '../../apps/mobile/src/lib/theme/partnerHue.ts'

// This file lives outside any package, so bare imports resolve from apps/api.
const apiRequire = createRequire(new URL('../../apps/api/package.json', import.meta.url))
const { ObjectId } = (await import(apiRequire.resolve('mongodb'))) as typeof Mongo
const { hashPassword } = (await import(
  apiRequire.resolve('better-auth/crypto')
)) as typeof AuthCrypto

const [uri, dbArg, timezone = 'UTC'] = process.argv.slice(2)
if (!uri || !/^mongodb:\/\/(127\.0\.0\.1|localhost)[:/]/.test(uri)) {
  throw new Error('seed.ts writes only to a loopback MongoDB (the isolated stack)')
}
const dbName = resolveDbName(['--db', dbArg ?? ''], '')

const DAY = 86_400_000
const now = Date.now()
// Days in the run's zone (`TIMEZONE` in stack.mjs), the one the browser is put in.
const dayFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const dayKey = (daysAgo: number) => dayFormat.format(new Date(now - daysAgo * DAY))

type Hue = ReturnType<typeof partnerHueFor>
interface Person extends OnboardingProfileInput {
  hue?: Hue
  /**
   * The drawn face, pinned. Left to sign-up, a face is the least used in the
   * pool after a hash of the id, and the id is new every run: each locale's
   * stack drew a different Anna, so the same person changed face from one
   * listing to the next. Ground is an index into DEFAULT_AVATAR_GROUNDS,
   * picked to stand off the card it sits on.
   */
  face: shared.DefaultAvatar
}

/*
 * Handles other than `sofia` are fixture names that the chosen capture states
 * keep out of frame. Names and bios are the board's.
 */
const SOFIA: Person = {
  handle: 'sofia',
  face: { pool: 'W', index: 9, ground: 0 },
  displayName: 'Sofia',
  birthDate: '1996-04-12',
  gender: 'female',
  nativeLanguages: [{ code: 'es' }],
  learning: [{ code: 'en', level: 'intermediate', priority: 1 }],
  country: 'ES',
  bio: 'Madrid. I cook for friends and practise English on them.',
  interests: ['cooking', 'travel', 'music'],
}
const CAST: Record<string, Person> = {
  anna: {
    handle: 'demo_anna',
    face: { pool: 'W', index: 34, ground: 3 },
    displayName: 'Anna',
    birthDate: '1995-03-02',
    gender: 'female',
    nativeLanguages: [{ code: 'ru' }],
    learning: [{ code: 'es', level: 'intermediate', priority: 1 }],
    country: 'RU',
    bio: 'Kazan. Cooking, long walks and Spanish podcasts.',
    interests: ['cooking', 'books'],
    hue: 'lilac',
  },
  george: {
    handle: 'demo_george',
    face: { pool: 'M', index: 44, ground: 4 },
    displayName: 'George',
    birthDate: '1991-09-20',
    gender: 'male',
    nativeLanguages: [{ code: 'en' }],
    learning: [{ code: 'es', level: 'beginner', priority: 1 }],
    country: 'GB',
    bio: 'I cook a lot and talk about it even more. Help me order tapas without pointing.',
    interests: ['cooking', 'travel'],
    hue: 'tangerine',
  },
  yuki: {
    handle: 'demo_yuki',
    face: { pool: 'W', index: 6, ground: 1 },
    displayName: 'Yuki',
    birthDate: '1998-01-15',
    gender: 'female',
    nativeLanguages: [{ code: 'ja' }, { code: 'en' }],
    learning: [{ code: 'es', level: 'beginner', priority: 1 }],
    country: 'JP',
    bio: 'Osaka. Flamenco on Thursdays, verbs on every other day.',
    interests: ['dance', 'music'],
    hue: 'mint',
  },
  marina: {
    handle: 'demo_marina',
    face: { pool: 'W', index: 26, ground: 4 },
    displayName: 'Marina',
    birthDate: '1994-07-07',
    gender: 'female',
    nativeLanguages: [{ code: 'pt' }],
    learning: [{ code: 'es', level: 'intermediate', priority: 1 }],
    country: 'BR',
    bio: 'Recife. Learning Spanish for a year in Valencia.',
    interests: ['travel'],
  },
  elif: {
    handle: 'demo_elif',
    face: { pool: 'W', index: 24, ground: 5 },
    displayName: 'Elif',
    birthDate: '1997-05-30',
    gender: 'female',
    nativeLanguages: [{ code: 'tr' }],
    learning: [{ code: 'es', level: 'beginner', priority: 1 }],
    country: 'TR',
    bio: 'İzmir. Telenovelas without subtitles is the plan.',
    interests: ['films'],
  },
}

const db = (await connectToDatabase(uri, dbName)).db
await ensureIndexes(db)

/**
 * An account with a profile, as `ensureAccount` in `testAccounts.ts` makes
 * one, except that the id is drawn until its hue is the wanted one.
 */
async function makeAccount(person: Person, daysOld: number): Promise<string> {
  let id = new ObjectId()
  while (person.hue && partnerHueFor(String(id)) !== person.hue) id = new ObjectId()
  const at = new Date(now - daysOld * DAY)
  await db.collection(COLLECTIONS.user).insertOne({
    _id: id,
    name: person.displayName,
    email: emailFor(person.handle),
    emailVerified: true,
    createdAt: at,
    updatedAt: at,
  })
  await db.collection(COLLECTIONS.account).insertOne({
    userId: id,
    accountId: String(id),
    providerId: 'credential',
    issuer: 'local:credential',
    password: await hashPassword(PASSWORD),
    createdAt: at,
    updatedAt: at,
  })
  const { hue: _hue, face, ...input } = person
  await createProfile(db, String(id), null, {
    ...input,
    nativeLanguages: [input.nativeLanguages[0]!],
    learning: [input.learning[0]!],
  })
  await db.collection(COLLECTIONS.profiles).updateOne({ _id: String(id) } as never, {
    $set: {
      nativeLanguages: input.nativeLanguages,
      learning: input.learning,
      createdAt: at,
      lastActiveAt: new Date(now - 10 * 60_000),
      defaultAvatar: face,
      timezone,
    },
  })
  return String(id)
}

/*
 * The flags production runs with (read from `/app-config` on 27 Oct 2026):
 * the v3 look, Copilot, Venus's videos and her WhatsApp pack. Everything else
 * stays at its default, off — a store picture shows only what everybody gets.
 */
await db.collection('appConfig').replaceOne(
  { _id: 'current' } as never,
  {
    ...structuredClone(shared.DEFAULT_APP_CONFIG),
    _id: 'current',
    flags: {
      ...(shared.DEFAULT_APP_CONFIG.flags ?? {}),
      v3Home: true,
      copilotEnabled: true,
      venusStories: true,
      whatsappStickers: true,
    },
    updatedAt: new Date(),
  },
  { upsert: true },
)

const sofia = await makeAccount(SOFIA, 420)
const ids: Record<string, string> = {}
for (const [key, person] of Object.entries(CAST)) ids[key] = await makeAccount(person, 200)

const minutesAgo = (m: number) => new Date(now - m * 60_000)

/** Plays a thread through the real send path, then stamps the times. */
async function thread(
  partner: string,
  turns: { from: string; body: string; id?: string; corrects?: string }[],
  times: Date[],
) {
  const sent = new Map<string, string>()
  const order: string[] = []
  let conversationId = ''
  for (const turn of turns) {
    let messageId: string
    if (!conversationId) {
      const other = turn.from === sofia ? partner : sofia
      const started = await startConversation(db, turn.from, { toUserId: other, body: turn.body })
      conversationId = started.conversation._id.toHexString()
      messageId = started.message._id.toHexString()
    } else if (turn.corrects) {
      const { message } = await sendCorrection(db, turn.from, {
        conversationId,
        targetMessageId: sent.get(turn.corrects)!,
        corrected: turn.body,
      })
      messageId = message._id.toHexString()
    } else {
      const { message } = await sendTextMessage(db, turn.from, { conversationId, body: turn.body })
      messageId = message._id.toHexString()
    }
    if (turn.id) sent.set(turn.id, messageId)
    order.push(messageId)
  }
  const messages = db.collection(COLLECTIONS.messages)
  for (const [i, id] of order.entries()) {
    const at = times[i] ?? times.at(-1)!
    await messages.updateOne({ _id: new ObjectId(id) } as never, {
      $set: { createdAt: at, deliveredAt: at, readAt: at },
    })
  }
  const last = times[order.length - 1] ?? times.at(-1)!
  await db
    .collection(COLLECTIONS.conversations)
    .updateOne({ _id: new ObjectId(conversationId) } as never, {
      $set: { 'lastMessage.createdAt': last, updatedAt: last, createdAt: times[0] },
    })
  return { conversationId, sent, order }
}

/*
 * Shot 2 and shot 6: Sofia and Anna. Today's sitting is the board's, and its
 * last word is Anna's, left unanswered, so Home says Anna is waiting. The
 * sitting three days back is what most of the Echo cards were saved from; it
 * sits above the fold of the thread shot.
 */
const anna = await thread(
  ids.anna!,
  [
    { from: ids.anna!, id: 'e0', body: 'Have a lovely weekend!' },
    { from: sofia, id: 'e1', body: 'I am looking forward to our call.' },
    { from: ids.anna!, id: 'e2', body: 'That sounds delicious.' },
    { from: sofia, id: 'e3', body: 'I nearly cried at the end of the film.' },
    // Calls unlock after five messages from the person being rung (CALLS_LOCKED).
    { from: sofia, body: 'See you on Saturday!' },
    {
      from: ids.anna!,
      id: 'cook',
      body: '¡Hola! Ayer he cocinado borscht para mi familia. ¡Fue un éxito!',
    },
    {
      from: sofia,
      corrects: 'cook',
      body: '¡Hola! Ayer cociné borscht para mi familia. ¡Fue un éxito!',
    },
    { from: sofia, id: 'beach', body: 'On Saturday I went at the beach with my cousins.' },
    {
      from: ids.anna!,
      id: 'e4',
      corrects: 'beach',
      body: 'On Saturday I went to the beach with my cousins.',
    },
    { from: ids.anna!, id: 'e5', body: 'What did you cook on Sunday? I want the recipe!' },
  ],
  [4330, 4325, 4320, 4310, 4300, 190, 186, 160, 150, 120].map(minutesAgo),
)

/*
 * Two chats Sofia opened today, so People reads "3 of 5" new chats left.
 * Anna's thread does not count: Anna opened it.
 */
await thread(
  ids.marina!,
  [{ from: sofia, body: '¡Hola Marina! ¿Practicamos un poco?' }],
  [minutesAgo(600)],
)
await thread(
  ids.elif!,
  [{ from: sofia, body: '¡Hola Elif! Me encantan las telenovelas también.' }],
  [minutesAgo(560)],
)
const george = await thread(
  ids.george!,
  [
    { from: ids.george!, body: 'Hi Sofia! How do I say "llevo dos años viviendo aquí"?' },
    { from: ids.george!, id: 'g1', body: "I've lived here for two years." },
    { from: ids.george!, id: 'g2', body: 'Could you say that more slowly, please?' },
    { from: ids.george!, id: 'g3', body: 'It was a standing ovation.' },
    { from: ids.george!, id: 'g4', body: 'We ate far too much popcorn.' },
    { from: sofia, body: '¡Jaja! Me pasa siempre.' },
  ],
  [3000, 2990, 2980, 2970, 2960, 2950].map(minutesAgo),
)
const yuki = await thread(
  ids.yuki!,
  [
    { from: ids.yuki!, body: 'Hola Sofia, ¿quedamos a medio camino?' },
    { from: ids.yuki!, id: 'y1', body: "Let's meet halfway." },
    { from: ids.yuki!, id: 'y2', body: 'Nice to meet you, too.' },
    { from: sofia, body: '¡Igualmente!' },
  ],
  [4000, 3990, 3980, 3970].map(minutesAgo),
)

/*
 * Shot 3: twelve cards due, six from Anna, four from George, two from Yuki.
 * Each is a line Sofia saved from a thread, her own language on the back.
 */
const BACKS: Record<string, string> = {
  e0: '¡Que tengas un buen fin de semana!',
  e1: 'Tengo muchas ganas de nuestra llamada.',
  e2: 'Suena delicioso.',
  e3: 'Casi lloro al final de la película.',
  e4: 'El sábado fui a la playa con mis primos.',
  e5: '¿Qué cocinaste el domingo? ¡Quiero la receta!',
  g1: 'Llevo dos años viviendo aquí.',
  g2: '¿Podrías decirlo más despacio, por favor?',
  g3: 'Fue una ovación de pie.',
  g4: 'Comimos demasiadas palomitas.',
  y1: 'Quedemos a medio camino.',
  y2: 'Encantada de conocerte también.',
}
// The backs are given, so the translator is never asked; it fails if it is.
const noTranslator = {
  translation: { translate: () => Promise.reject(new Error('offline')) },
} as never
for (const [t, keys] of [
  [anna, ['e0', 'e1', 'e2', 'e3', 'e4', 'e5']],
  [george, ['g1', 'g2', 'g3', 'g4']],
  [yuki, ['y1', 'y2']],
] as const) {
  for (const key of keys) {
    await captureFromMessage(db, noTranslator, sofia, {
      conversationId: t.conversationId,
      messageId: t.sent.get(key)!,
      translation: BACKS[key],
      translationLang: 'es',
    })
  }
}
await db
  .collection(COLLECTIONS.echoCards)
  .updateMany({ userId: sofia } as never, { $set: { 'srs.due': new Date(now - 60_000) } })

/*
 * Shots 4, 7, 8: a member of fourteen months with a 34-day streak, a banked
 * freeze, and a balance of 2,340 after three frames and a sticker pack.
 */
const frames = shared.COSMETICS.filter((c) => c.kind === 'frame')
  .slice(0, 3)
  .map((c) => c.id)
const stickers = shared.COSMETICS.filter((c) => c.kind === 'stickers')
  .slice(0, 1)
  .map((c) => c.id)
const owned = [...frames, ...stickers]
/*
 * Earned 12,400 over fourteen months (past Spool), balance 2,340: the rest went
 * on the items owned and on freezes and repairs along the way.
 */
const EARNED = 12_400
const BALANCE = 2_340
// The sends above earned a little; this tops the total up to EARNED.
const earnedSoFar = (await readAggregates(db, sofia)).all
await awardTokens(db, {
  userId: sofia,
  kind: 'signupBonus',
  amount: EARNED - earnedSoFar,
  at: new Date(now - 400 * DAY),
  refId: 'signup',
})
const days = []
for (let d = 0; d < 34; d++) {
  days.push({
    _id: `${sofia}:${dayKey(d)}`,
    userId: sofia,
    day: dayKey(d),
    source: d === 0 ? 'checkIn' : 'activity',
    firstAt: new Date(now - d * DAY - 5 * 3_600_000),
    actions: 1 + ((d * 7) % 5),
  })
}
// The sends above already recorded today; the history replaces it whole.
await db.collection(COLLECTIONS.streakDays).deleteMany({ userId: sofia } as never)
await db.collection(COLLECTIONS.streakDays).insertMany(days as never[])
await db.collection(COLLECTIONS.profiles).updateOne({ _id: sofia } as never, {
  $set: {
    tokenSpent: EARNED - BALANCE,
    streakFreezes: 1,
    cosmetics: owned,
    equipped: { frame: frames[0] },
    'streak.current': 34,
    // Past 100, the last of Venus's days, so shot 8 has every one of them open.
    'streak.longest': 190,
    'streak.lastQualifiedDay': dayKey(0),
    'streak.lastActionDay': dayKey(0),
  },
})

console.log(
  JSON.stringify({
    sofia,
    ids,
    annaConversation: anna.conversationId,
    password: PASSWORD,
    email: emailFor('sofia'),
  }),
)
process.exit(0)
