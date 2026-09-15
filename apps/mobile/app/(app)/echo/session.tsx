import Feather from '@expo/vector-icons/Feather'
import {
  asksProduction,
  ECHO_GRADES,
  echoAudiosOf,
  productionVerdict,
  scheduledDelayMinutes,
  type EchoAudio,
  type EchoVoice,
  type EchoCard,
  type EchoGrade,
  type EchoImage,
  type EchoSrs,
} from '@langx/shared'
import { useAudioPlayer } from 'expo-audio'
import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Keyboard, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useEchoQueue, useMe, useSubmitEchoReviews } from '../../../src/api/queries'
import { Button } from '../../../src/components/ui/Button'
import { ProgressBar } from '../../../src/components/ui/ProgressBar'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { EmptyState } from '../../../src/components/ui/EmptyState'
import { useT } from '../../../src/i18n'
import { voiceLabel } from '../../../src/i18n/labels'
import { useDisplayNames } from '../../../src/i18n/displayNames'
import { ensurePlaybackAudioMode } from '../../../src/lib/audioSession'
import { echoAskParams, type EchoAskParams } from '../../../src/lib/echoAsk'
import { compactDuration } from '../../../src/lib/format'
import { goBackTo } from '../../../src/lib/navigation'
import { postLanguages } from '../../../src/lib/postLanguage'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { offlineQueue } from '../../../src/lib/echoSnapshot'
import {
  forgetPendingReviews,
  readEchoSnapshot,
  rememberEchoCards,
  rememberPendingReviews,
} from '../../../src/lib/echoStore'
import { newClientId } from '../../../src/lib/unsentMessages'

/**
 * How long after the answer appears a grade is ignored. Long enough to absorb
 * the keyboard's dismissal, short enough that nobody deliberate is refused.
 */
const REVEAL_GUARD_MS = 400

/**
 * How tall a card's picture is allowed to get. The sentence is the card; a
 * portrait photograph given its whole aspect ratio would push it under the
 * fold on a phone, and the picture is the hint, not the question.
 */
const PICTURE_MAX_HEIGHT = 240

interface Graded {
  reviewId: string
  cardId: string
  grade: EchoGrade
  durationMs: number
}

/** The card's schedule, as `srs.ts` wants it: the wire carries ISO strings. */
function parseSrs(card: EchoCard): EchoSrs {
  return {
    ...card.srs,
    due: new Date(card.srs.due),
    lastReviewedAt: card.srs.lastReviewedAt ? new Date(card.srs.lastReviewedAt) : null,
  }
}

/**
 * The review.
 *
 * The deck is frozen the moment it arrives. A background refetch that
 * reordered what is in front of somebody mid-answer would be the worst kind
 * of bug — invisible, and it loses their place.
 *
 * Grades are held in memory and sent as one batch at the end. The `reviewId`
 * is minted when the grade is given, not when the batch is sent: the unique
 * `{ userId, reviewId }` index is what makes a retry harmless, and an id
 * generated inside the retry would be fresh every time and defeat it.
 */
export default function EchoSessionScreen() {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const names = useDisplayNames()
  const { lang } = useLocalSearchParams<{ lang?: string }>()
  const queue = useEchoQueue(lang)
  const submit = useSubmitEchoReviews()
  const me = useMe()
  // The languages a post may be written in, which is what decides whether a
  // card can be asked about at all. Same pair the composer itself uses.
  const languages = useMemo(() => postLanguages(me.data?.learning), [me.data])

  const [deck, setDeck] = useState<EchoCard[] | null>(null)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  /** What was typed for this card, when it is a production review. */
  const [typed, setTyped] = useState('')
  const [graded, setGraded] = useState<Graded[]>([])
  const [saved, setSaved] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const shownAt = useRef(Date.now())
  /**
   * When the answer was shown, so the gesture that showed it cannot also
   * grade the card.
   *
   * On a production card the keyboard is open, and dismissing it moves the
   * whole layout up — so the grade row lands exactly where the Check button
   * was, and the browser dispatches the click to whatever is under the finger
   * at touch-up. One tap revealed the answer and marked the card Again,
   * silently. Caught on an iPhone; a mouse never reproduces it, and neither
   * does a recognition card, which has no keyboard to dismiss.
   */
  const revealedAt = useRef(0)

  /** True when the deck came off the device rather than off the server. */
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    if (deck !== null) return
    if (queue.data) {
      setDeck(queue.data.cards)
      // The cheapest moment to know the truth is the moment it arrives.
      void rememberEchoCards(queue.data.cards)
      return
    }
    /*
     * No network. `isPaused` is the honest signal — `queryNetwork.ts` wires
     * the radio to TanStack, so a request made offline is held rather than
     * failed — and `isError` covers the web, where it is sent and refused.
     */
    if (!queue.isPaused && !queue.isError) return
    void readEchoSnapshot().then((snapshot) => {
      if (!snapshot) return
      setDeck(offlineQueue(snapshot, new Date()))
      setOffline(true)
    })
  }, [deck, queue.data, queue.isPaused, queue.isError])

  const card = deck?.[index]
  const recordings = card ? echoAudiosOf(card) : []
  /**
   * Writing it, rather than recognising it. The card and its schedule are
   * unchanged — this is a presentation of the same row, decided by a pure
   * rule so that leaving and coming back asks the same thing.
   */
  const producing = card ? asksProduction(parseSrs(card), card.front) : false

  /**
   * Sends whatever has been graded, and keeps it if the send fails.
   *
   * Nothing clears `graded` on failure, so the retry sends the identical
   * array with the identical ids — which the server then reports as
   * `duplicate` for anything that did land. Surviving the app being killed
   * would need local storage, which Phase 1 deliberately does not have.
   */
  async function flush(batch: Graded[]): Promise<void> {
    if (batch.length === 0 || saved) return
    try {
      await submit.mutateAsync({ reviews: batch })
      setSaved(true)
      setSaveFailed(false)
      void forgetPendingReviews(batch.map((entry) => entry.reviewId))
    } catch {
      setSaveFailed(true)
      /*
       * Written to the device before the screen says anything. Keeping them
       * in memory was enough for a dropped request; it is not enough for a
       * phone that is closed on the train, and the grades are work somebody
       * did. The ids were minted when each grade was given, so sending them
       * again tomorrow is the same idempotent batch.
       */
      void rememberPendingReviews(
        batch.map((entry) => ({ ...entry, at: new Date().toISOString() })),
      )
    }
  }

  /*
   * Leaving early still counts. A half session is worth keeping, and the
   * ledger cannot double-count it — so the cleanup sends rather than asks.
   */
  const flushRef = useRef(flush)
  const pendingRef = useRef(graded)
  useEffect(() => {
    flushRef.current = flush
    pendingRef.current = graded
  })
  useEffect(() => {
    return () => {
      void flushRef.current(pendingRef.current)
    }
  }, [])

  function reveal(): void {
    // Before the state change, so the layout has one frame to settle rather
    // than shifting under the finger that is still down.
    Keyboard.dismiss()
    revealedAt.current = Date.now()
    setRevealed(true)
  }

  function grade(value: EchoGrade): void {
    if (!card) return
    // See `revealedAt`. A grade this close to the reveal is the same tap.
    if (Date.now() - revealedAt.current < REVEAL_GUARD_MS) return
    const entry: Graded = {
      // Hermes has no `crypto.randomUUID`; this is the same minter the unsent
      // message rows use, for the same reason.
      reviewId: newClientId(Date.now(), Math.random()),
      cardId: card._id,
      grade: value,
      durationMs: Math.max(0, Date.now() - shownAt.current),
    }
    const next = [...graded, entry]
    setGraded(next)
    setRevealed(false)
    setTyped('')
    shownAt.current = Date.now()
    setIndex((current) => current + 1)
    if (deck && index + 1 >= deck.length) void flush(next)
  }

  const verdict = card && producing ? productionVerdict(typed, card.front) : 'wrong'

  /** The card as a question for the feed, or `null` when it cannot be one. */
  const ask = card ? echoAskParams(card, languages) : null
  /** The same card as the other question: whether the sentence is right. */
  const askCorrection = card ? echoAskParams(card, languages, 'correction') : null

  /** What the grade buttons say: the same function the server will run. */
  function intervalLabel(value: EchoGrade): string {
    if (!card) return ''
    return compactDuration(t, scheduledDelayMinutes({ srs: parseSrs(card) }, value, new Date()))
  }

  /**
   * Opens the composer as a pronunciation post, with the sentence in it.
   *
   * It used to open the conversation the card came from, which made this the
   * one path out of Echo and back into a chat — and limited it to the cards
   * that had a chat behind them. A pack card, the one most likely to have no
   * recording, got nothing, and the ask depended on one person being willing.
   * The feed asks the same question of everybody.
   *
   * The card's id rides along so that `compose` can tell the card which post
   * it asked on; that link is what lets an answer's recording come back here
   * in one tap.
   */
  function askTheFeed(params: EchoAskParams): void {
    router.push({ pathname: '/(app)/compose', params })
  }

  const header = (
    <ScreenHeader title={t('echo.title')} onBack={() => goBackTo('/(app)/(tabs)/echo')} />
  )

  /*
   * The same header with the count beside it. A bar says roughly how far in
   * you are; the number says how many more questions there are, which is the
   * thing somebody deciding whether to finish actually wants.
   */
  const deckHeader = (deck: EchoCard[], index: number) => (
    <ScreenHeader
      title={t('echo.title')}
      onBack={() => goBackTo('/(app)/(tabs)/echo')}
      trailing={
        <Text style={styles.counter}>
          {t('echo.sessionProgress', { done: index + 1, total: deck.length })}
        </Text>
      }
    />
  )

  if (queue.isPending || deck === null) {
    return (
      <Screen fluid>
        {header}
        <View style={styles.loading}>
          <Skeleton height={220} />
        </View>
      </Screen>
    )
  }

  if (deck.length === 0) {
    return (
      <Screen fluid>
        {header}
        <EmptyState
          icon="repeat"
          title={t('echo.sessionEmptyTitle')}
          body={t('echo.sessionEmptyBody')}
        />
      </Screen>
    )
  }

  // Past the last card: what happened, and whether it was kept.
  if (!card) {
    const remembered = graded.filter((entry) => entry.grade !== 'again').length
    return (
      <Screen fluid>
        {header}
        <View style={styles.done}>
          {/*
            The tab's tile, closing the loop the tab opened — in the neutral
            grey, not the yellow. Yellow in this app means "tappable, and the
            thing to press"; a yellow square that does nothing, above an
            outlined button that does, teaches the opposite. `gift.tsx` makes
            the same split: its tile is yellow only while it is the button.
          */}
          <View style={styles.doneTile}>
            <Feather name="check" size={72} color={colors.success} />
          </View>
          <Text style={styles.doneTitle}>{t('echo.doneTitle')}</Text>
          <View style={styles.counts}>
            <Count label={t('echo.doneReviewed')} value={graded.length} />
            <Count label={t('echo.doneRemembered')} value={remembered} />
            <Count label={t('echo.doneAgain')} value={graded.length - remembered} />
          </View>
          <Text style={styles.doneBody}>{t('echo.doneBody')}</Text>
          {saveFailed ? (
            <View style={styles.retry}>
              <Text style={styles.failed}>{t('echo.saveFailedBody')}</Text>
              <Button
                label={t('common.tryAgain')}
                variant="secondary"
                loading={submit.isPending}
                onPress={() => void flush(graded)}
              />
            </View>
          ) : (
            <Button
              label={t('common.done')}
              variant="secondary"
              onPress={() => goBackTo('/(app)/(tabs)/echo')}
              style={styles.doneAction}
            />
          )}
        </View>
      </Screen>
    )
  }

  return (
    <Screen fluid>
      {deckHeader(deck, index)}
      {offline ? (
        /* Said out loud, because the grades will sit on the phone until there
           is a network and somebody should know that before they answer ten. */
        <Text style={styles.offline}>{t('echo.offlineSession')}</Text>
      ) : null}
      <View style={styles.progress}>
        <ProgressBar
          value={index / deck.length}
          height={6}
          accessibilityLabel={t('echo.sessionProgress', { done: index, total: deck.length })}
        />
      </View>
      <ScrollView contentContainerStyle={styles.card}>
        {card.image ? <CardPicture key={card.image.url} image={card.image} /> : null}
        {producing && !revealed ? (
          /*
           * The meaning, and a box. The sentence is the answer, so it is not
           * on screen — and neither is the speaker button below, which would
           * read it out.
           */
          <>
            <Text style={styles.prompt}>
              {t('echo.producePrompt', { language: names.language(card.lang) })}
            </Text>
            <Text style={styles.front}>{card.back}</Text>
            <TextInput
              value={typed}
              onChangeText={setTyped}
              style={styles.input}
              placeholder={t('echo.produceHint')}
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              accessibilityLabel={t('echo.produceHint')}
            />
          </>
        ) : (
          /* The sentence as it was written. Data, never interface copy. */
          <Text style={styles.front}>{card.front}</Text>
        )}
        {!producing && recordings.length === 0 && ask ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => askTheFeed(ask)}
            style={({ pressed }) => [styles.speaker, pressed && styles.pressed]}
          >
            <Feather name="mic" size={16} color={colors.accent} />
            <Text style={styles.speakerLabel}>{t('echo.askToHearIt')}</Text>
          </Pressable>
        ) : null}
        {/*
          Whether the sentence is right, which is a different question from how
          it is said and has no answer on the card to suppress it — a card can
          always turn out to be wrong. Only before the answer, so it does not
          sit among the grades.
        */}
        {!revealed && askCorrection ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => askTheFeed(askCorrection)}
            style={({ pressed }) => [styles.speaker, pressed && styles.pressed]}
          >
            <Feather name="edit-3" size={16} color={colors.accent} />
            <Text style={styles.speakerLabel}>{t('echo.askForCorrection')}</Text>
          </Pressable>
        ) : null}
        {/*
          Every recording, each with its own player: one card can hold several
          people saying the same sentence, and which of them is speaking is the
          whole reason to keep more than one.
        */}
        {!producing || revealed
          ? recordings.map((audio) => <Recording key={audio.url} audio={audio} />)
          : null}
        {/*
          The pack's own readings, under the people. Labelled by register and
          by nothing else: there is nobody to credit, and a name here would
          make a voice model indistinguishable from the volunteer above it.
        */}
        {!producing || revealed
          ? (card.voices ?? []).map((take) => <Reading key={take.voice} take={take} />)
          : null}

        {revealed ? (
          <>
            <View style={styles.rule} />
            {producing ? (
              <>
                <Text style={styles.yourAnswerLabel}>{t('echo.yourAnswer')}</Text>
                <Text style={styles.yourAnswer}>{typed.trim() || '—'}</Text>
                {/*
                  Reported, never graded. Only the person knows whether they
                  knew it or guessed it, and a checker that decided for them
                  would be wrong in exactly the cases that matter.
                */}
                <Text style={verdict === 'wrong' ? styles.verdictWrong : styles.verdictOk}>
                  {t(
                    `echo.verdict${verdict === 'exact' ? 'Exact' : verdict === 'close' ? 'Close' : 'Wrong'}`,
                  )}
                </Text>
              </>
            ) : (
              <Text style={styles.back}>{card.back}</Text>
            )}
            {card.example ? <Text style={styles.example}>{card.example}</Text> : null}
          </>
        ) : null}
      </ScrollView>

      <View style={styles.actions}>
        {revealed ? (
          <View style={styles.grades}>
            {ECHO_GRADES.map((value) => (
              <Pressable
                key={value}
                accessibilityRole="button"
                onPress={() => grade(value)}
                style={({ pressed }) => [
                  styles.grade,
                  value === 'good' && styles.gradeGood,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.gradeLabel, value === 'good' && styles.gradeGoodLabel]}>
                  {t(`echo.${value}`)}
                </Text>
                <Text style={[styles.gradeInterval, value === 'good' && styles.gradeGoodInterval]}>
                  {intervalLabel(value)}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Button
            label={t(producing && typed.trim().length > 0 ? 'echo.check' : 'echo.show')}
            onPress={reveal}
          />
        )}
      </View>
    </Screen>
  )
}

/**
 * The card's picture, whole.
 *
 * It used to be a fixed 140pt band with `contentFit: cover`, which did not
 * merely guess the shape wrong — it *cropped*: the screenshot that started
 * this had a face with the top of the head and the chin cut off. The box takes
 * the picture's own ratio instead, from the card when it carries one and from
 * the file itself when it does not, the way `ImageBubble` does for a message.
 *
 * `contain` rather than `cover`, and that is forced: the width is fixed at
 * 100%, so once `maxHeight` clamps a tall picture the box's ratio is no longer
 * the picture's and `cover` would crop again — exactly what this is fixing. No
 * background colour behind it, so the letterbox that clamping leaves does not
 * draw as two grey bands.
 */
function CardPicture({ image }: { image: EchoImage }) {
  const styles = useStyles()
  const [measured, setMeasured] = useState<number | null>(null)
  const ratio = image.width && image.height ? image.width / image.height : measured

  return (
    <View style={[styles.picture, { aspectRatio: ratio ?? 4 / 3 }]}>
      <Image
        source={{ uri: image.url }}
        style={styles.pictureFill}
        contentFit="contain"
        transition={150}
        onLoad={({ source }) => {
          if (ratio || !source.width || !source.height) return
          setMeasured(source.width / source.height)
        }}
      />
    </View>
  )
}

/**
 * One of the card's recordings, with its own player.
 *
 * A component per recording rather than one player the row switches between:
 * `useAudioPlayer` is a hook, so a card holding three voices needs three of
 * them, and a hook cannot be called in a loop from the screen itself.
 */
function Recording({ audio }: { audio: EchoAudio }) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const player = useAudioPlayer(audio.url)

  async function play(): Promise<void> {
    await ensurePlaybackAudioMode()
    void player.seekTo(0)
    player.play()
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('echo.play')}
      hitSlop={8}
      onPress={() => void play()}
      style={({ pressed }) => [styles.speaker, pressed && styles.pressed]}
    >
      <Feather name="volume-2" size={18} color={colors.accent} />
      {/* Who is speaking, so a person's recording is never taken for anything
          else — and, with several on one card, so the two can be told apart. */}
      <Text style={styles.speakerLabel}>
        {audio.speakerName ? t('echo.spokenBy', { name: audio.speakerName }) : t('echo.play')}
      </Text>
    </Pressable>
  )
}

/** A synthesised take. `Recording`'s twin, and deliberately not the same thing. */
function Reading({ take }: { take: EchoVoice }) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const player = useAudioPlayer(take.url)

  async function play(): Promise<void> {
    await ensurePlaybackAudioMode()
    void player.seekTo(0)
    player.play()
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={voiceLabel(t, take.voice)}
      hitSlop={8}
      onPress={() => void play()}
      style={({ pressed }) => [styles.speaker, pressed && styles.pressed]}
    >
      <Feather name="cpu" size={16} color={colors.textMuted} />
      <Text style={styles.voiceLabel}>{voiceLabel(t, take.voice)}</Text>
    </Pressable>
  )
}

function Count({ label, value }: { label: string; value: number }) {
  const styles = useStyles()
  return (
    <View style={styles.count}>
      <Text style={styles.countValue}>{value}</Text>
      <Text style={styles.countLabel}>{label}</Text>
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  loading: { padding: spacing.lg },
  progress: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  offline: {
    color: colors.textFaint,
    fontSize: 13,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    textAlign: 'center',
  },
  card: { alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  picture: {
    borderRadius: radius.md,
    maxHeight: PICTURE_MAX_HEIGHT,
    overflow: 'hidden',
    width: '100%',
  },
  pictureFill: { height: '100%', width: '100%' },
  front: { ...font.heading, color: colors.text, fontSize: 24, lineHeight: 32, textAlign: 'center' },
  speaker: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  speakerLabel: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  /* Quieter than a person's take, because it is the lesser of the two. */
  voiceLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '500' },
  pressed: { opacity: 0.6 },
  rule: { backgroundColor: colors.border, height: 1, width: '60%' },
  back: { color: colors.text, fontSize: 18, lineHeight: 26, textAlign: 'center' },
  prompt: { color: colors.textFaint, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  input: {
    ...font.body,
    alignSelf: 'stretch',
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: 18,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
    textAlign: 'center',
  },
  yourAnswerLabel: { color: colors.textFaint, fontSize: 12, fontWeight: '700' },
  yourAnswer: { color: colors.textMuted, fontSize: 17, textAlign: 'center' },
  verdictOk: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  verdictWrong: { color: colors.danger, fontSize: 14, fontWeight: '700' },
  example: { color: colors.textMuted, fontSize: 15, fontStyle: 'italic', textAlign: 'center' },
  actions: { padding: spacing.lg },
  grades: { flexDirection: 'row', gap: spacing.xs },
  grade: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    paddingVertical: 12,
  },
  /*
   * The expected answer, and the one yellow on this screen: "Show answer" is
   * gone by the time the grades are up, so nothing competes with it.
   */
  gradeGood: { backgroundColor: colors.primary, borderColor: colors.primaryShade },
  gradeLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  gradeGoodLabel: { color: colors.primaryText },
  gradeInterval: { color: colors.textFaint, fontSize: 12 },
  gradeGoodInterval: { color: colors.primaryTextMuted },
  counter: { color: colors.textMuted, fontSize: 14, fontVariant: ['tabular-nums'] },
  done: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  doneTile: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    // 40, as the tab's tile and the gift's.
    borderRadius: 40,
    height: 160,
    justifyContent: 'center',
    marginBottom: spacing.sm,
    width: 160,
  },
  doneTitle: { ...font.heading, color: colors.text },
  doneAction: { alignSelf: 'stretch' },
  // The tab's hairline strip, so the end of a session is drawn as the tab is.
  counts: {
    alignSelf: 'stretch',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  count: { alignItems: 'center', flex: 1, gap: 2, paddingVertical: spacing.md },
  countValue: { ...font.heading, color: colors.text },
  countLabel: { color: colors.textFaint, fontSize: 13 },
  doneBody: { color: colors.textMuted, fontSize: 15, textAlign: 'center' },
  retry: { alignSelf: 'stretch', gap: spacing.sm },
  failed: { color: colors.danger, fontSize: 14, textAlign: 'center' },
}))
