import Feather from '@expo/vector-icons/Feather'
import {
  ECHO_GRADES,
  scheduledDelayMinutes,
  type EchoCard,
  type EchoGrade,
  type EchoSrs,
} from '@langx/shared'
import { useAudioPlayer } from 'expo-audio'
import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useEchoQueue, useSubmitEchoReviews } from '../../../src/api/queries'
import { Button } from '../../../src/components/ui/Button'
import { ProgressBar } from '../../../src/components/ui/ProgressBar'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { EmptyState } from '../../../src/components/ui/EmptyState'
import { useT } from '../../../src/i18n'
import { ensurePlaybackAudioMode } from '../../../src/lib/audioSession'
import { goBackTo } from '../../../src/lib/navigation'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { newClientId } from '../../../src/lib/unsentMessages'

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
  const { lang } = useLocalSearchParams<{ lang?: string }>()
  const queue = useEchoQueue(lang)
  const submit = useSubmitEchoReviews()

  const [deck, setDeck] = useState<EchoCard[] | null>(null)
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [graded, setGraded] = useState<Graded[]>([])
  const [saved, setSaved] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const shownAt = useRef(Date.now())

  useEffect(() => {
    if (deck === null && queue.data) setDeck(queue.data.cards)
  }, [deck, queue.data])

  const card = deck?.[index]
  const player = useAudioPlayer(card?.audio?.url ?? null)

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
    } catch {
      setSaveFailed(true)
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

  function grade(value: EchoGrade): void {
    if (!card) return
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
    shownAt.current = Date.now()
    setIndex((current) => current + 1)
    if (deck && index + 1 >= deck.length) void flush(next)
  }

  /** What the grade buttons say: the same function the server will run. */
  function intervalLabel(value: EchoGrade): string {
    if (!card) return ''
    const minutes = scheduledDelayMinutes({ srs: parseSrs(card) }, value, new Date())
    if (minutes < 60) return t('format.minutesCompact', { count: Math.max(1, minutes) })
    if (minutes < 60 * 24) return t('format.hoursCompact', { count: Math.round(minutes / 60) })
    return t('format.daysCompact', { count: Math.round(minutes / (60 * 24)) })
  }

  /**
   * Opens the conversation with the composer armed and the sentence in it.
   *
   * The one path that leads out of Echo and back into a conversation. It
   * asks on a *new* message rather than on the one the card came from —
   * `ask` is written once, at send time, and the original may never have
   * carried one. The recording that answers it can be kept in turn.
   */
  function askToHearIt(target: EchoCard): void {
    if (target.source.kind !== 'chat') return
    router.push({
      pathname: '/(app)/chat/[id]',
      params: {
        id: target.source.conversationId,
        at: target.source.messageId,
        ask: 'pronunciation',
        draft: target.front,
      },
    })
  }

  async function play(): Promise<void> {
    await ensurePlaybackAudioMode()
    void player.seekTo(0)
    player.play()
  }

  const header = (
    <ScreenHeader title={t('echo.title')} onBack={() => goBackTo('/(app)/(tabs)/echo')} />
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
          <Feather name="check-circle" size={40} color={colors.accent} />
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
            <Button label={t('common.done')} onPress={() => goBackTo('/(app)/(tabs)/echo')} />
          )}
        </View>
      </Screen>
    )
  }

  return (
    <Screen fluid>
      {header}
      <View style={styles.progress}>
        <ProgressBar
          value={index / deck.length}
          height={6}
          accessibilityLabel={t('echo.sessionProgress', { done: index, total: deck.length })}
        />
      </View>
      <ScrollView contentContainerStyle={styles.card}>
        {card.image ? (
          <Image source={{ uri: card.image.url }} style={styles.picture} contentFit="cover" />
        ) : null}
        {/* The sentence as it was written. Data, never interface copy. */}
        <Text style={styles.front}>{card.front}</Text>
        {!card.audio && card.source.kind === 'chat' ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => askToHearIt(card)}
            style={({ pressed }) => [styles.speaker, pressed && styles.pressed]}
          >
            <Feather name="mic" size={16} color={colors.accent} />
            <Text style={styles.speakerLabel}>{t('echo.askToHearIt')}</Text>
          </Pressable>
        ) : null}
        {card.audio ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('echo.play')}
            hitSlop={8}
            onPress={() => void play()}
            style={({ pressed }) => [styles.speaker, pressed && styles.pressed]}
          >
            <Feather name="volume-2" size={18} color={colors.accent} />
            {/* Who is speaking, so a person's recording is never taken for
                anything else. */}
            <Text style={styles.speakerLabel}>
              {card.audio.speakerName
                ? t('echo.spokenBy', { name: card.audio.speakerName })
                : t('echo.play')}
            </Text>
          </Pressable>
        ) : null}

        {revealed ? (
          <>
            <View style={styles.rule} />
            <Text style={styles.back}>{card.back}</Text>
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
                style={({ pressed }) => [styles.grade, pressed && styles.pressed]}
              >
                <Text style={styles.gradeLabel}>{t(`echo.${value}`)}</Text>
                <Text style={styles.gradeInterval}>{intervalLabel(value)}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <Button label={t('echo.show')} onPress={() => setRevealed(true)} />
        )}
      </View>
    </Screen>
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
  card: { alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  picture: { borderRadius: radius.md, height: 140, width: '100%' },
  front: { ...font.heading, color: colors.text, fontSize: 24, lineHeight: 32, textAlign: 'center' },
  speaker: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  speakerLabel: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  pressed: { opacity: 0.6 },
  rule: { backgroundColor: colors.border, height: 1, width: '60%' },
  back: { color: colors.text, fontSize: 18, lineHeight: 26, textAlign: 'center' },
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
  gradeLabel: { color: colors.text, fontSize: 14, fontWeight: '700' },
  gradeInterval: { color: colors.textFaint, fontSize: 12 },
  done: { alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  doneTitle: { ...font.heading, color: colors.text },
  counts: { flexDirection: 'row', gap: spacing.lg },
  count: { alignItems: 'center', gap: 2 },
  countValue: { ...font.title, color: colors.text },
  countLabel: { color: colors.textFaint, fontSize: 13 },
  doneBody: { color: colors.textMuted, fontSize: 15, textAlign: 'center' },
  retry: { alignSelf: 'stretch', gap: spacing.sm },
  failed: { color: colors.danger, fontSize: 14, textAlign: 'center' },
}))
