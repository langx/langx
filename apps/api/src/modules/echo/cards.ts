import {
  attachmentsOf,
  ECHO_AUDIO_MAX,
  ECHO_FRONT_MAX_LENGTH,
  ERROR_CODES,
  type CaptureEchoInput,
  type CaptureEchoResult,
  type EchoAudio,
  type EchoCard,
  type EchoCardPage,
  type EchoImage,
  type Media,
  type EchoQueue,
  type EchoSource,
  type EchoSummary,
  type ApplyEchoCorrectionInput,
  type ArchiveEchoCardsInput,
  type ArchiveEchoCardsResult,
  type AttachEchoAudioInput,
  echoAudiosOf,
  type LinkEchoAskInput,
  type ListEchoCardsQuery,
  newCardSrs,
  sourceKeyOf,
  SRS_RULES,
  translatableLanguageSchema,
  type TranslateRequestInput,
  translateTargetFor,
  type UpdateEchoCardInput,
} from '@langx/shared'
import { MongoServerError, ObjectId, type Db, type Filter } from 'mongodb'
import { COLLECTIONS } from '../../db/collections'
import { ApiError } from '../../lib/ApiError'
import { consumeQuota } from '../../lib/quota'
import type { StorageProvider } from '../../storage/StorageProvider'
import type { TranslationProvider } from '../../translation/TranslationProvider'
import { assertConversationAccess } from '../chat/access'
import type { Conversation, Message } from '../chat/conversations'
import { assertAttachable, deleteObjects } from '../feed/attachments'
import {
  notHidden,
  type Post,
  type PostCorrectionDoc,
  type PronunciationAnswerDoc,
} from '../feed/documents'
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

/**
 * A pronunciation answer, as a card's recording.
 *
 * One function for the two ways an answer reaches a card — copied at capture
 * when the card is made from the post, and attached later when the card asked
 * the question and somebody replied. They were the same eight lines twice, and
 * the second copy is exactly where `slowMedia` or the speaker's name would
 * have been forgotten.
 */
async function audioFromAnswer(db: Db, answer: PronunciationAnswerDoc): Promise<EchoAudio> {
  const speaker = await db
    .collection<Profile>(COLLECTIONS.profiles)
    .findOne({ _id: answer.authorId }, { projection: { displayName: 1 } })
  return {
    url: answer.media.url,
    ...(answer.slowMedia ? { slowUrl: answer.slowMedia.url } : {}),
    origin: 'post',
    ...(speaker?.displayName ? { speakerName: speaker.displayName } : {}),
    answerId: answer._id.toHexString(),
  }
}

/**
 * The two audio fields, written together, always.
 *
 * `audio` is the list's first item and nothing else — the shape a build frozen
 * in the stores reads, and the one in every offline snapshot already written.
 * Keeping the mirror in one function is what stops the two drifting: there is
 * no write of `audios` anywhere that does not go through here.
 */
function audioFields(audios: EchoAudio[]): Pick<EchoCardDoc, 'audio' | 'audios'> {
  const first = audios[0]
  return first ? { audio: first, audios } : {}
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
  const audio = answer ? await audioFromAnswer(db, answer) : undefined

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
      return { lang: post.language, front, back, ...audioFields(audio ? [audio] : []) }
    },
    me,
  )
}

/**
 * A card somebody wrote themselves.
 *
 * The only capture that is handed its own contents: there is no message to
 * read them off, and no access check to make, because the person is the
 * source. What is left is the same machinery as every other capture — the
 * daily ceiling, the unique source key, the translated back — which is the
 * whole reason this is a branch of `captureEcho` rather than an endpoint of
 * its own.
 *
 * Idempotent on `clientId`. A card with nothing behind it has no natural key,
 * so the client mints one and `card_source_unique` turns a retry into the
 * no-op every other capture already gets for free.
 */
export async function captureManual(
  db: Db,
  deps: CaptureDeps,
  userId: string,
  args: { clientId: string; front: string; back?: string; lang: string },
): Promise<CaptureEchoResult> {
  const me = await profileOf(db, userId)
  if (!me) throw notFound('Complete onboarding first')

  const front = args.front.trim().slice(0, ECHO_FRONT_MAX_LENGTH)
  const target = targetLangFor(me)

  return await upsertCard(
    db,
    userId,
    { kind: 'manual', id: args.clientId },
    async () => {
      /*
       * A typed back is kept as typed. An absent one is translated like any
       * other capture, so writing down a single word still makes a whole card
       * — unless the card is already in the language it would be translated
       * into, where the answer would be the sentence back again.
       */
      const back = args.back
        ? args.back.trim()
        : args.lang === target
          ? ''
          : await backFor(db, deps, front, target, undefined)
      return { lang: args.lang, front, back }
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
  if (input.source.kind === 'manual') {
    return await captureManual(db, deps, userId, {
      clientId: input.source.clientId,
      front: input.source.front,
      ...(input.source.back ? { back: input.source.back } : {}),
      lang: input.source.lang,
    })
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

/**
 * A file the card's owner is putting on it, as the card stores it.
 *
 * `origin: 'self'` is the load-bearing part rather than a label. Every other
 * origin names a *copy* of an object something else still plays, and telling
 * the two apart is what lets `updateCard` below delete the old file when it is
 * ours and leave it alone when it is not.
 */
function selfImage(media: Media): EchoImage {
  return {
    url: media.url,
    ...(media.width ? { width: media.width } : {}),
    ...(media.height ? { height: media.height } : {}),
    origin: 'self',
  }
}

function selfAudio(media: Media): EchoAudio {
  return { url: media.url, origin: 'self' }
}

/**
 * Fixing the two lines a person reads, the language they are in, and the two
 * files on the card.
 *
 * The schedule is left where it is: a card whose wording was corrected is the
 * same card and keeps the interval it earned. So is the source — the link
 * back to the message stays true about where the sentence came from, even
 * once the copy on the card no longer matches what is in the thread. The
 * language is the one *fact* about the origin a person may now overwrite; see
 * `updateEchoCardSchema` for what that costs on a card made from a message.
 *
 * The `userId` in the filter is the whole of the access control, as it is for
 * `removeCard`: a card belongs to one person and nobody else can see it, so a
 * card that is not theirs is a card that is not there.
 *
 * `image` and `audio` are three-state — absent, `null`, a `Media` — and the
 * schema says which is which. What is worth saying here is the deletion rule:
 * **the object behind a replaced or cleared file is removed only when its
 * origin was `self`.** Every other origin is a URL this card copied from a
 * message, a post or a pack, all of which still play it; deleting one would
 * take the recording out of somebody's thread because a card stopped
 * pointing at it. A bare `deleteObjects(previous.url)` here would look right
 * and be exactly that bug.
 *
 * **A rewritten sentence loses its readings.** `voices` are a machine reading
 * *this* text in *this* language, so once either changes they are readings of
 * a card that no longer exists — and left in place they would play the old
 * line under the new one. They come off the card, which is what makes "Read
 * it aloud" reappear for the new text. The objects stay in storage: a
 * reading is content-addressed and shared, so the same file may be on
 * somebody else's card, and the next person to keep the old sentence is
 * served it for nothing. A person's recording is not touched by this — it
 * was a person, saying whatever they said, and only they can decide it no
 * longer fits.
 */
export async function updateCard(
  db: Db,
  userId: string,
  cardId: string,
  input: UpdateEchoCardInput,
  storagePublicBaseUrl?: string,
  storage?: StorageProvider,
): Promise<EchoCard> {
  if (!ObjectId.isValid(cardId)) throw notFound('Card not found')

  const cards = db.collection<EchoCardDoc>(COLLECTIONS.echoCards)
  const card = await cards.findOne({ _id: new ObjectId(cardId), userId })
  if (!card) throw notFound('Card not found')

  /*
   * Checked before anything is written, and both files in one call: that is
   * what makes a photo and a recording saved together cost one unit of the
   * daily media budget rather than two, exactly as a pronunciation answer's
   * two takes do.
   */
  const attached = [input.image, input.audio].filter((media) => !!media)
  if (attached.length > 0) {
    const me = await profileOf(db, userId)
    if (!me) throw notFound('Complete onboarding first')
    if (input.image)
      await assertAttachable(db, userId, me, [input.image], storagePublicBaseUrl, 'image')
    if (input.audio)
      await assertAttachable(db, userId, me, [input.audio], storagePublicBaseUrl, 'audio')
  }

  /*
   * Removals first, then the new file: saving an edit that takes one recording
   * off and adds another must not be refused by the ceiling for a moment it is
   * never actually over.
   *
   * Nothing the card already holds is re-sent. An `EchoAudio` has no
   * `contentType` to travel as a `Media`, and re-sending one would both invent
   * that and restamp somebody else's recording as `self` — which is a licence
   * to delete a file the post it came from still plays.
   */
  const touchesAudio =
    input.audio !== undefined || (input.removeAudio !== undefined && input.removeAudio.length > 0)
  const dropped = new Set(input.removeAudio ?? [])
  const remaining =
    input.audio === null ? [] : echoAudiosOf(card).filter((entry) => !dropped.has(entry.url))
  const nextAudios = input.audio ? [...remaining, selfAudio(input.audio)] : remaining
  if (nextAudios.length > ECHO_AUDIO_MAX) {
    throw new ApiError(
      ERROR_CODES.VALIDATION_FAILED,
      `A card holds at most ${ECHO_AUDIO_MAX} recordings`,
    )
  }

  const set: Partial<EchoCardDoc> = {
    front: input.front,
    back: input.back,
    // `lang` only when one was sent: a client that predates the language
    // field must not blank the language of every card it saves.
    ...(input.lang ? { lang: input.lang } : {}),
    ...(input.image ? { image: selfImage(input.image) } : {}),
    ...(touchesAudio ? audioFields(nextAudios) : {}),
  }
  // The empty strings are typed, not inferred: Mongo's `$unset` accepts only
  // `'' | 1 | true`, and a widened `string` is rejected by the driver's types.
  const rewritten =
    input.front !== card.front || (input.lang !== undefined && input.lang !== card.lang)
  const unset: { image?: ''; audio?: ''; audios?: ''; voices?: '' } = {
    ...(input.image === null ? { image: '' as const } : {}),
    ...(touchesAudio && nextAudios.length === 0 ? { audio: '' as const, audios: '' as const } : {}),
    ...(rewritten && card.voices?.length ? { voices: '' as const } : {}),
  }

  const updated = await cards.findOneAndUpdate(
    { _id: card._id, userId },
    { $set: set, ...(Object.keys(unset).length > 0 ? { $unset: unset } : {}) },
    { returnDocument: 'after' },
  )
  if (!updated) throw notFound('Card not found')

  // After the write, and only ours. See the rule in the doc comment: a
  // recording that survived the edit is not gone, and one the card only ever
  // held a copy of is not ours to remove.
  const kept = new Set(nextAudios.map((entry) => entry.url))
  await deleteObjects(storage, [
    input.image !== undefined && card.image?.origin === 'self' ? card.image.url : undefined,
    ...echoAudiosOf(card)
      .filter((entry) => entry.origin === 'self' && !kept.has(entry.url))
      .map((entry) => entry.url),
  ])

  return toEchoCard(updated)
}

/**
 * Remember that this card asked the feed how its sentence is said.
 *
 * Written after the post exists rather than as part of creating it: the feed
 * module has no idea what an Echo card is, and this is the whole price of
 * keeping it that way. A link that never gets written costs the button on the
 * post screen and nothing else, so the client does not retry or report it.
 *
 * The post must be the caller's own pronunciation post. Not a privacy
 * measure — a post id is not a secret — but the invariant the attach below
 * leans on: a card can only ever point at a question its owner asked.
 */
export async function linkAsk(
  db: Db,
  userId: string,
  cardId: string,
  input: LinkEchoAskInput,
): Promise<EchoCard> {
  if (!ObjectId.isValid(cardId)) throw notFound('Card not found')
  if (!ObjectId.isValid(input.postId)) throw notFound('Post not found')

  const post = await db
    .collection<Post>(COLLECTIONS.posts)
    .findOne({ _id: new ObjectId(input.postId), authorId: userId, ...notHidden() })
  if (!post) throw notFound('Post not found')

  /*
   * Which field the link lands in is the post's own kind, not the caller's
   * word for it: a card remembers the question it asked for a recording and
   * the question it asked for a correction separately, so asking for one does
   * not take the other's button off a post somebody is still answering.
   */
  const field = post.kind === 'pronunciation' ? 'askedPostId' : 'askedCorrectionPostId'

  /*
   * The post is asked from one card, so a second card claiming it would break
   * the partial unique index rather than overwrite. Clearing it first is what
   * makes re-asking from a different card work, and it is why this is two
   * writes instead of one.
   */
  await db
    .collection<EchoCardDoc>(COLLECTIONS.echoCards)
    .updateMany({ userId, [field]: input.postId }, { $unset: { [field]: '' } })

  const updated = await db
    .collection<EchoCardDoc>(COLLECTIONS.echoCards)
    .findOneAndUpdate(
      { _id: new ObjectId(cardId), userId },
      { $set: { [field]: input.postId } },
      { returnDocument: 'after' },
    )
  if (!updated) throw notFound('Card not found')

  return toEchoCard(updated)
}

/**
 * Put cards away as learned, or take them back.
 *
 * One `updateMany` with the owner in the filter, so a list containing somebody
 * else's card id changes nothing of theirs and is not an error either: the ids
 * come from a selection on screen, and a stale one is a card that has since
 * been removed rather than an attack. `changed` is what actually moved.
 */
export async function setArchived(
  db: Db,
  userId: string,
  input: ArchiveEchoCardsInput,
  now: Date = new Date(),
): Promise<ArchiveEchoCardsResult> {
  const ids = input.cardIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id))
  if (ids.length === 0) return { changed: 0 }

  const result = await db.collection<EchoCardDoc>(COLLECTIONS.echoCards).updateMany(
    /*
     * Only the cards actually changing state. Without the second clause,
     * archiving a card that is already away would rewrite its `archivedAt` to
     * now — moving the day it was learned every time somebody taps the action
     * on a selection that already included it — and `changed` would count it.
     */
    { userId, _id: { $in: ids }, archivedAt: { $exists: !input.archived } },
    input.archived
      ? { $set: { archivedAt: now } }
      : // Unset rather than null: "in the rotation" is the absence of this
        // field everywhere that reads it.
        { $unset: { archivedAt: '' } },
  )
  return { changed: result.modifiedCount }
}

/** One card of the caller's, by id. What the card screen reads. */
export async function getCard(db: Db, userId: string, cardId: string): Promise<EchoCard> {
  if (!ObjectId.isValid(cardId)) throw notFound('Card not found')
  const doc = await db
    .collection<EchoCardDoc>(COLLECTIONS.echoCards)
    .findOne({ _id: new ObjectId(cardId), userId })
  if (!doc) throw notFound('Card not found')
  return toEchoCard(doc)
}

/** The caller's card that asked this post, if one did. */
export async function cardForPost(
  db: Db,
  userId: string,
  postId: string,
): Promise<EchoCard | null> {
  if (!ObjectId.isValid(postId)) return null
  const doc = await db
    .collection<EchoCardDoc>(COLLECTIONS.echoCards)
    .findOne({ userId, $or: [{ askedPostId: postId }, { askedCorrectionPostId: postId }] })
  return doc ? toEchoCard(doc) : null
}

/**
 * Put a pronunciation answer's recording on the card that asked for it.
 *
 * `answer.postId === card.askedPostId` is the entire authorisation check, and
 * it is enough: the card is the caller's, and `linkAsk` only ever points a
 * card at a pronunciation post the caller wrote. Nothing here trusts a URL —
 * the client sends an answer id and the media is read from the answer.
 *
 * The recording is **added**, not substituted. Two people answering the same
 * question is the reason to ask the feed rather than a dictionary: one says it
 * the way it is written and the other the way it is said, and a card that kept
 * only the newer of them threw away the comparison. Keeping the same answer
 * twice is a no-op rather than a duplicate — the button is on every row, and
 * tapping one twice should not put the same voice on the card twice.
 */
export async function attachAnswerAudio(
  db: Db,
  userId: string,
  cardId: string,
  input: AttachEchoAudioInput,
): Promise<EchoCard> {
  if (!ObjectId.isValid(cardId)) throw notFound('Card not found')
  if (!ObjectId.isValid(input.answerId)) throw notFound('Recording not found')

  const cards = db.collection<EchoCardDoc>(COLLECTIONS.echoCards)
  const card = await cards.findOne({ _id: new ObjectId(cardId), userId })
  if (!card) throw notFound('Card not found')

  const answer = await db
    .collection<PronunciationAnswerDoc>(COLLECTIONS.pronunciationAnswers)
    .findOne({ _id: new ObjectId(input.answerId) })
  if (!answer || !card.askedPostId || answer.postId.toHexString() !== card.askedPostId) {
    throw notFound('Recording not found')
  }

  const held = echoAudiosOf(card)
  if (held.some((entry) => entry.answerId === input.answerId)) return toEchoCard(card)
  if (held.length >= ECHO_AUDIO_MAX) {
    throw new ApiError(
      ERROR_CODES.VALIDATION_FAILED,
      `A card holds at most ${ECHO_AUDIO_MAX} recordings`,
    )
  }

  const updated = await cards.findOneAndUpdate(
    { _id: card._id, userId },
    { $set: audioFields([...held, await audioFromAnswer(db, answer)]) },
    { returnDocument: 'after' },
  )
  if (!updated) throw notFound('Card not found')

  return toEchoCard(updated)
}

/**
 * Put a correction's sentence on the card that asked for it.
 *
 * `attachAnswerAudio`'s twin, authorised the same way — the correction has to
 * belong to the post this card asked — and it writes the **front**, because a
 * card whose sentence is wrong teaches the mistake every time it comes back.
 *
 * Unlike a recording this replaces rather than adds: a sentence has one right
 * version, and keeping both would leave the learner to decide which of the two
 * lines on the card is the one to learn.
 */
export async function applyCorrection(
  db: Db,
  userId: string,
  cardId: string,
  input: ApplyEchoCorrectionInput,
): Promise<EchoCard> {
  if (!ObjectId.isValid(cardId)) throw notFound('Card not found')
  if (!ObjectId.isValid(input.correctionId)) throw notFound('Correction not found')

  const cards = db.collection<EchoCardDoc>(COLLECTIONS.echoCards)
  const card = await cards.findOne({ _id: new ObjectId(cardId), userId })
  if (!card) throw notFound('Card not found')

  const correction = await db
    .collection<PostCorrectionDoc>(COLLECTIONS.postCorrections)
    .findOne({ _id: new ObjectId(input.correctionId) })
  if (
    !correction ||
    !card.askedCorrectionPostId ||
    correction.postId.toHexString() !== card.askedCorrectionPostId
  ) {
    throw notFound('Correction not found')
  }

  const front = correction.corrected.trim().slice(0, ECHO_FRONT_MAX_LENGTH)
  if (front.length === 0)
    throw new ApiError(ERROR_CODES.VALIDATION_FAILED, 'There is no sentence to keep')

  const updated = await cards.findOneAndUpdate(
    { _id: card._id, userId },
    { $set: { front } },
    { returnDocument: 'after' },
  )
  if (!updated) throw notFound('Card not found')

  return toEchoCard(updated)
}

/** Somebody's search term, as a pattern that matches only itself. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function listCards(
  db: Db,
  userId: string,
  query: ListEchoCardsQuery,
): Promise<EchoCardPage> {
  const filter: Filter<EchoCardDoc> = {
    userId,
    ...(query.lang ? { lang: query.lang } : {}),
    // One list or the other. A card put away as learned sitting between two
    // you are still learning would make the word mean nothing on screen.
    archivedAt: { $exists: query.archived },
  }
  if (query.cursor && ObjectId.isValid(query.cursor)) {
    filter._id = { $lt: new ObjectId(query.cursor) }
  }
  if (query.q) {
    /*
     * Unanchored, which `handleSearch` argues at length against — and the
     * argument is about a different query. There the pattern is matched across
     * every profile in the collection, so an unanchored regex is a scan per
     * keystroke; here `userId` is an equality bound on `owner_lang_recent`, so
     * the walk is one person's cards and the pattern only decides which of
     * them are returned. A card is found by any word in it, which is what
     * somebody looking for a sentence they half remember actually needs, and
     * no index can offer that. Nothing is added to `indexes.ts` for it.
     */
    const rx = { $regex: escapeRegex(query.q), $options: 'i' }
    filter.$or = [{ front: rx }, { back: rx }, { example: rx }]
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
    // The whole point of archiving: never asked again. The schedule is left
    // alone, so a card taken back out simply becomes due again.
    archivedAt: { $exists: false },
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

  const [byLanguage, reviewedToday, reviewedThisWeek, next] = await Promise.all([
    cards
      .aggregate<{ _id: string; total: number; due: number }>([
        // Archived cards count nowhere: the badge on the tab and the totals
        // beside each language both describe what is still being learned.
        { $match: { userId, archivedAt: { $exists: false } } },
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
    // The soonest card still waiting, for a tab with nothing due to say when
    // there will be. `owner_due` sorts it, so this is a seek rather than a
    // scan — and archived cards are excluded here for the same reason they are
    // excluded above: they are not coming back.
    cards.findOne(
      { userId, archivedAt: { $exists: false }, 'srs.due': { $gt: now } },
      { sort: { 'srs.due': 1 }, projection: { 'srs.due': 1 } },
    ),
  ])

  const languages = byLanguage.map((row) => ({ lang: row._id, total: row.total, due: row.due }))
  return {
    due: languages.reduce((sum, row) => sum + row.due, 0),
    total: languages.reduce((sum, row) => sum + row.total, 0),
    languages,
    reviewedToday,
    reviewedThisWeek,
    nextDue: next ? next.srs.due.toISOString() : null,
  }
}
