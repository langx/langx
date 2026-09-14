import {
  attachmentsOf,
  ECHO_FRONT_MAX_LENGTH,
  ERROR_CODES,
  type CaptureEchoInput,
  type CaptureEchoResult,
  type EchoAudio,
  type EchoCardPage,
  type EchoImage,
  type EchoQueue,
  type EchoSource,
  type EchoSummary,
  type ListEchoCardsQuery,
  newCardSrs,
  sourceKeyOf,
  SRS_RULES,
  translatableLanguageSchema,
  type TranslateRequestInput,
  translateTargetFor,
} from '@langx/shared'
import { MongoServerError, ObjectId, type Db, type Filter } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { consumeQuota } from '../../lib/quota'
import type { TranslationProvider } from '../../translation/TranslationProvider'
import { assertConversationAccess } from '../chat/access'
import type { Conversation, Message } from '../chat/conversations'
import { notHidden, type Post } from '../feed/documents'
import { readCorrectionSummary } from '../feed/feed'
import { readAnswerSummary } from '../feed/pronunciation'
import { blockedUserIds } from '../moderation/blocks'
import { effectiveTier } from '../profiles/entitlement'
import type { Profile } from '../profiles/profiles'
import { lookupTranslation, rememberTranslation } from '../translation/translate'
import { toEchoCard, type EchoCardDoc } from './documents'

/**
 * What a capture needs from outside the database.
 *
 * A named bag rather than positional arguments because the list will grow —
 * the design document has pack audio and a second media source waiting in
 * Phase 2 — and because it is what lets a test hand in a provider that
 * answers without a network.
 */
export interface CaptureDeps {
  translation: TranslationProvider
}

/**
 * Message types a card can be made from.
 *
 * `image` is here and the design document's table says it should not be: a
 * photo with a caption is typed `image`, so refusing the type would have made
 * the card's `image` field unreachable from a chat and the Images section
 * untrue. The caption is the sentence; the photo is the cue. Everything else
 * is refused because it has no sentence to put on the front — a sticker, a
 * meeting, a quiz — or because its author already holds the card, which is
 * the `phrase` case.
 */
const CAPTURABLE_MESSAGE_TYPES = new Set<Message['type']>(['text', 'correction', 'image'])

function notFound(what: string): ApiError {
  return new ApiError(ERROR_CODES.NOT_FOUND, what)
}

/** The sentence the card asks about, bounded but never rejected. */
function frontOf(message: Message): string {
  const text = message.type === 'correction' ? (message.correction?.corrected ?? '') : message.body
  return text.trim().slice(0, ECHO_FRONT_MAX_LENGTH)
}

async function profileOf(db: Db, userId: string): Promise<Profile | null> {
  return await db.collection<Profile>(COLLECTIONS.profiles).findOne({ _id: userId })
}

type TargetLang = TranslateRequestInput['targetLang']

/**
 * The reader's own language, if anything can be translated into it.
 *
 * `translateTargetFor` answers in `string` because it is also the answer to
 * "which of your native languages do you read in", and not every language in
 * the table has a machine translation behind it. Parsing rather than casting
 * is what keeps a signed language out of a request the provider would refuse.
 */
function targetLangFor(profile: Profile): TargetLang | undefined {
  const chosen = translateTargetFor(profile)
  if (!chosen) return undefined
  const parsed = translatableLanguageSchema.safeParse(chosen)
  return parsed.success ? parsed.data : undefined
}

/**
 * Spends one capture against the daily ceiling.
 *
 * Called only once the card is known to be new: re-tapping Add echo on
 * something already kept must be free, because the gesture is advertised as
 * idempotent and the unique index makes the second tap a no-op anyway.
 *
 * A refusal is a 402 like every other quota, but the app must not turn it
 * into a paywall. The ceiling is the same on all three tiers — there is
 * nothing here to sell.
 */
async function spendCapture(db: Db, profile: Profile): Promise<void> {
  const quota = await consumeQuota(db, profile._id, effectiveTier(profile), 'echoCaptures')
  if (quota.consumed) return
  throw new ApiError(
    ERROR_CODES.QUOTA_EXCEEDED,
    'Daily Echo capture limit reached',
    quota.nextAvailableAt ? { retryAt: quota.nextAvailableAt.toISOString() } : undefined,
  )
}

/**
 * The card's back: what the sentence means, in the reader's own language.
 *
 * Three sources, in the order they cost: the translation the reader already
 * has on screen, the one the cache already holds, and finally the provider.
 * Only the last is a request anybody pays for, and the shared cache means a
 * sentence translated in a thread is free to keep and one translated here is
 * free to read back in the thread.
 *
 * An empty string when nothing can translate it. A card with a front and no
 * back is still a card — the sentence is still the thing being learned — and
 * failing the capture because a third party is down would lose it.
 */
async function backFor(
  db: Db,
  deps: CaptureDeps,
  text: string,
  targetLang: TargetLang | undefined,
  offered: { text: string; lang: string | undefined } | undefined,
): Promise<string> {
  if (!targetLang || text.length === 0) return ''
  if (offered && (offered.lang === undefined || offered.lang === targetLang)) return offered.text

  const input = { text, targetLang }
  const cached = await lookupTranslation(db, input)
  if (cached) return cached.translatedText

  try {
    const result = await deps.translation.translate(input)
    await rememberTranslation(db, input, result)
    return result.translatedText
  } catch {
    // No key configured, or the provider is down. Optional services degrade.
    return ''
  }
}

/** The photo the sentence arrived with, if it arrived with one. */
function imageOf(message: Message): EchoImage | undefined {
  const picture = attachmentsOf(message).find((file) => file.contentType.startsWith('image/'))
  if (!picture) return undefined
  return {
    url: picture.url,
    ...(picture.width ? { width: picture.width } : {}),
    ...(picture.height ? { height: picture.height } : {}),
    origin: 'chat',
  }
}

/**
 * A person saying this sentence, if one has.
 *
 * The voice note that answered its `pronunciation` ask — which is a field
 * read now that the answer stamps the message it answers, rather than the
 * guess the chat screen used to make from whatever was on screen.
 *
 * The URL is copied, not the message id: the recording can be deleted and
 * the card must keep playing.
 */
async function chatAudioFor(db: Db, message: Message): Promise<EchoAudio | undefined> {
  if (!message.answeredAt || !message.answeredBy) return undefined

  const answer = await db
    .collection<Message>(COLLECTIONS.messages)
    .findOne(
      { answersMessageId: message._id, deletedAt: { $exists: false } },
      { sort: { createdAt: 1 } },
    )
  const recording = answer
    ? attachmentsOf(answer).find((file) => file.contentType.startsWith('audio/'))
    : undefined
  if (!recording) return undefined

  const speaker = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOne({ _id: message.answeredBy }, { projection: { displayName: 1 } })

  return {
    url: recording.url,
    origin: 'chat',
    ...(speaker?.displayName ? { speakerName: speaker.displayName } : {}),
  }
}

/**
 * Writes the card, or hands back the one that is already there.
 *
 * The lookup before the insert is the cheap path and the duplicate-key catch
 * is the correct one: two taps race routinely, and only the index decides for
 * the whole cluster at once. Neither path is an error — Add echo twice is a
 * no-op by design.
 */
async function upsertCard(
  db: Db,
  userId: string,
  source: EchoSource,
  build: () => Promise<
    Omit<EchoCardDoc, '_id' | 'userId' | 'source' | 'sourceKey' | 'srs' | 'createdAt'>
  >,
  profile: Profile,
): Promise<CaptureEchoResult> {
  const cards = db.collection<EchoCardDoc>(COLLECTIONS.echoCards)
  const sourceKey = sourceKeyOf(source)

  const existing = await cards.findOne({ userId, sourceKey })
  if (existing) return { card: toEchoCard(existing), created: false }

  // After the lookup and before the provider call: a capture that will not
  // write a card must not spend a slot, and a slot must be spent before
  // anything is billed on our behalf.
  await spendCapture(db, profile)

  const now = new Date()
  const doc: EchoCardDoc = {
    _id: new ObjectId(),
    userId,
    ...(await build()),
    source,
    sourceKey,
    srs: newCardSrs(now),
    createdAt: now,
  }

  try {
    await cards.insertOne(doc)
  } catch (caught) {
    if (!(caught instanceof MongoServerError) || caught.code !== 11000) throw caught
    const winner = await cards.findOne({ userId, sourceKey })
    if (!winner) throw caught
    return { card: toEchoCard(winner), created: false }
  }

  return { card: toEchoCard(doc), created: true }
}

export async function captureFromMessage(
  db: Db,
  deps: CaptureDeps,
  userId: string,
  args: {
    conversationId: string
    messageId: string
    translation?: string
    translationLang?: string
  },
): Promise<CaptureEchoResult> {
  // Participancy and a live block check, in one line, before anything else is
  // read. A stranger gets the same 404 a missing conversation gets.
  const conversation: Conversation = await assertConversationAccess(db, args.conversationId, userId)

  if (!ObjectId.isValid(args.messageId)) throw notFound('Message not found')
  const message = await db.collection<Message>(COLLECTIONS.messages).findOne({
    _id: new ObjectId(args.messageId),
    conversationId: conversation._id,
    deletedAt: { $exists: false },
  })
  if (!message) throw notFound('Message not found')

  if (!CAPTURABLE_MESSAGE_TYPES.has(message.type)) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'This kind of message cannot be echoed')
  }
  const front = frontOf(message)
  if (front.length === 0) {
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'There is no sentence to keep')
  }

  const partnerId = conversation.participants.find((id) => id !== userId) ?? message.senderId
  const [me, partner] = await Promise.all([profileOf(db, userId), profileOf(db, partnerId)])
  if (!me) throw notFound('Complete onboarding first')

  /*
   * The language the front is in: the partner's first native language with a
   * written form. `nativeLanguages` only, deliberately — `translateTargetFor`
   * also reads a stored preference, and what somebody prefers to *read* says
   * nothing about what they speak.
   *
   * The fallbacks matter more than they look. A partner whose native
   * languages are all signed, or who has deleted their account, would
   * otherwise make the capture fail on a sentence that is perfectly good.
   */
  const lang =
    (partner ? translateTargetFor({ nativeLanguages: partner.nativeLanguages }) : undefined) ??
    message.translation?.sourceLang ??
    me.learning[0]?.code
  if (!lang)
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'No language to file this card under')

  const target = targetLangFor(me)
  const offered = args.translation
    ? { text: args.translation, lang: args.translationLang }
    : message.translation
      ? { text: message.translation.text, lang: message.translation.lang }
      : undefined

  return await upsertCard(
    db,
    userId,
    {
      kind: 'chat',
      conversationId: conversation._id.toHexString(),
      messageId: message._id.toHexString(),
      partnerId,
    },
    async () => {
      const [back, audio] = await Promise.all([
        backFor(db, deps, front, target, offered),
        chatAudioFor(db, message),
      ])
      const image = imageOf(message)
      return { lang, front, back, ...(audio ? { audio } : {}), ...(image ? { image } : {}) }
    },
    me,
  )
}

export async function captureFromPost(
  db: Db,
  deps: CaptureDeps,
  userId: string,
  args: { postId: string },
): Promise<CaptureEchoResult> {
  if (!ObjectId.isValid(args.postId)) throw notFound('Post not found')
  const postId = new ObjectId(args.postId)

  const [post, hidden, me] = await Promise.all([
    db.collection<Post>(COLLECTIONS.posts).findOne({ _id: postId, ...notHidden() }),
    blockedUserIds(db, userId),
    profileOf(db, userId),
  ])
  if (!post) throw notFound('Post not found')
  // 404 rather than 403, as everywhere else in the feed: a blocked account is
  // absent, and a 403 would confirm it exists.
  if (hidden.includes(post.authorId)) throw notFound('Post not found')
  if (!me) throw notFound('Complete onboarding first')

  const [corrections, answers] = await Promise.all([
    readCorrectionSummary(db, userId, [postId]),
    readAnswerSummary(db, userId, [postId]),
  ])

  /*
   * The corrected sentence, not the one that needed correcting. What a
   * learner should keep is the version that is right — and "top" here is the
   * oldest, which is what the feed itself ranks first, not the most-liked.
   */
  const top = corrections.topByPost.get(postId.toHexString())
  const front = (top?.corrected ?? post.body).trim().slice(0, ECHO_FRONT_MAX_LENGTH)
  if (front.length === 0)
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'There is no sentence to keep')

  const answer = answers.topByPost.get(postId.toHexString())
  const speaker = answer
    ? await db
        .collection<Profile>(COLLECTIONS.profiles)
        .findOne({ _id: answer.authorId }, { projection: { displayName: 1 } })
    : null
  const audio: EchoAudio | undefined = answer
    ? {
        url: answer.media.url,
        ...(answer.slowMedia ? { slowUrl: answer.slowMedia.url } : {}),
        origin: 'post',
        ...(speaker?.displayName ? { speakerName: speaker.displayName } : {}),
      }
    : undefined

  const target = targetLangFor(me)

  return await upsertCard(
    db,
    userId,
    { kind: 'post', postId: postId.toHexString(), authorId: post.authorId },
    async () => {
      // The original body, not the corrected front: a learner reading the back
      // wants what the sentence means, and the correction usually fixed
      // grammar rather than meaning.
      const back = await backFor(
        db,
        deps,
        post.body.trim().slice(0, ECHO_FRONT_MAX_LENGTH),
        target,
        undefined,
      )
      return { lang: post.language, front, back, ...(audio ? { audio } : {}) }
    },
    me,
  )
}

export async function captureEcho(
  db: Db,
  deps: CaptureDeps,
  userId: string,
  input: CaptureEchoInput,
): Promise<CaptureEchoResult> {
  if (input.source.kind === 'post') {
    return await captureFromPost(db, deps, userId, { postId: input.source.postId })
  }
  return await captureFromMessage(db, deps, userId, {
    conversationId: input.source.conversationId,
    messageId: input.source.messageId,
    ...(input.source.translation ? { translation: input.source.translation } : {}),
    ...(input.source.translationLang ? { translationLang: input.source.translationLang } : {}),
  })
}

/**
 * Forgetting a card, by its id or by what it was made from.
 *
 * The source key is the second way in because the chat screen only ever knows
 * a message id: it draws the mark from `echoed` on the message and has no
 * card id to send, and `DELETE` carries no body to put one in.
 *
 * A card that is already gone is not an error. Removing twice is the same
 * shape of idempotence as adding twice.
 */
export async function removeCard(db: Db, userId: string, idOrSourceKey: string): Promise<void> {
  const cards = db.collection<EchoCardDoc>(COLLECTIONS.echoCards)
  const filter: Filter<EchoCardDoc> = idOrSourceKey.includes(':')
    ? { userId, sourceKey: idOrSourceKey }
    : ObjectId.isValid(idOrSourceKey)
      ? { userId, _id: new ObjectId(idOrSourceKey) }
      : { userId, sourceKey: idOrSourceKey }
  await cards.deleteOne(filter)
}

export async function listCards(
  db: Db,
  userId: string,
  query: ListEchoCardsQuery,
): Promise<EchoCardPage> {
  const filter: Filter<EchoCardDoc> = { userId, ...(query.lang ? { lang: query.lang } : {}) }
  if (query.cursor && ObjectId.isValid(query.cursor)) {
    filter._id = { $lt: new ObjectId(query.cursor) }
  }

  // `{ createdAt: -1, _id: -1 }` is the tail of `owner_lang_recent`, so the
  // sort is a walk of the index whether or not a language was named.
  const rows = await db
    .collection<EchoCardDoc>(COLLECTIONS.echoCards)
    .find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(query.limit + 1)
    .toArray()

  const items = rows.slice(0, query.limit)
  return {
    items: items.map(toEchoCard),
    nextCursor: rows.length > query.limit ? (items.at(-1)?._id.toHexString() ?? null) : null,
  }
}

/**
 * What to review now.
 *
 * A card made a minute ago is due — `newCardSrs` sets `due` to the moment of
 * capture — which is why Phase 1 needs no separate "new cards" intake and why
 * `echoNewCardsPerDay` costs no code while it is null.
 */
export async function dueQueue(
  db: Db,
  userId: string,
  lang?: string,
  now: Date = new Date(),
): Promise<EchoQueue> {
  const cards = db.collection<EchoCardDoc>(COLLECTIONS.echoCards)
  const filter: Filter<EchoCardDoc> = {
    userId,
    'srs.due': { $lte: now },
    ...(lang ? { lang } : {}),
  }

  const [rows, dueCount] = await Promise.all([
    cards.find(filter).sort({ 'srs.due': 1 }).limit(SRS_RULES.sessionSize).toArray(),
    cards.countDocuments(filter),
  ])

  return { cards: rows.map(toEchoCard), dueCount, sessionSize: SRS_RULES.sessionSize }
}

export async function summary(
  db: Db,
  userId: string,
  now: Date = new Date(),
): Promise<EchoSummary> {
  const cards = db.collection<EchoCardDoc>(COLLECTIONS.echoCards)
  const startOfDay = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  // Rolling, like the day beside it rather than a calendar week. Two windows
  // on one screen that are counted differently read as one of them being
  // wrong, and the Monday reset would be the half nobody expects.
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [byLanguage, reviewedToday, reviewedThisWeek] = await Promise.all([
    cards
      .aggregate<{ _id: string; total: number; due: number }>([
        { $match: { userId } },
        {
          $group: {
            _id: '$lang',
            total: { $sum: 1 },
            due: { $sum: { $cond: [{ $lte: ['$srs.due', now] }, 1, 0] } },
          },
        },
        { $sort: { total: -1, _id: 1 } },
      ])
      .toArray(),
    db.collection(COLLECTIONS.echoReviews).countDocuments({ userId, at: { $gte: startOfDay } }),
    db.collection(COLLECTIONS.echoReviews).countDocuments({ userId, at: { $gte: startOfWeek } }),
  ])

  const languages = byLanguage.map((row) => ({ lang: row._id, total: row.total, due: row.due }))
  return {
    due: languages.reduce((sum, row) => sum + row.due, 0),
    total: languages.reduce((sum, row) => sum + row.total, 0),
    languages,
    reviewedToday,
    reviewedThisWeek,
  }
}
