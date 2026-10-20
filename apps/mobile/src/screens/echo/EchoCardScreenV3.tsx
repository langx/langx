import Feather from '@expo/vector-icons/Feather'
import {
  echoAudiosOf,
  echoSynthVoicesFor,
  PLAN_LIMITS,
  type EchoAudio,
  type EchoCard,
  type EchoImage,
  type EchoVoice,
} from '@langx/shared'
import { useAudioPlayer } from 'expo-audio'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useEchoCard, useMe, useRemoveEcho, useSynthesiseEchoCard } from '../../api/queries'
import { cardTone } from '../../components/echo/EchoCardsV3Parts'
import { EchoHeaderV3 } from '../../components/echo/EchoHeaderV3'
import { PlayAgainProvider, usePlayAgain, useTakePlay } from '../../components/echo/PlayAgain'
import { LoadFailed } from '../../components/LoadFailed'
import { Button } from '../../components/ui/Button'
import { Screen } from '../../components/ui/Screen'
import { Skeleton } from '../../components/ui/Skeleton'
import { useAppConfig } from '../../hooks/useAppConfig'
import { useProfileCache } from '../../hooks/useProfileCache'
import { useLocale, useT } from '../../i18n'
import { useDisplayNames } from '../../i18n/displayNames'
import { voiceLabel } from '../../i18n/labels'
import { confirmAlert, showAlert } from '../../lib/alert'
import { track } from '../../lib/analytics'
import { echoAskParams } from '../../lib/echoAsk'
import { errorCodeOf } from '../../lib/errors'
import { dueInCompact } from '../../lib/format'
import { queryFailed } from '../../lib/listState'
import { goBackTo } from '../../lib/navigation'
import { postLanguages } from '../../lib/postLanguage'
import { makeStyles, useTheme, type V3Tokens } from '../../lib/theme'
import { partnerHueFor } from '../../lib/theme/partnerHue'
import { showToast } from '../../lib/toast'

/** As on the session card, and for the same reason: never crop the picture. */
const PICTURE_MAX_HEIGHT = 240

/**
 * One card, in the redesign's look (`V-EchoCard`), behind `flags.v3Home`.
 *
 * `echo/card/[id].tsx`'s card, read-only, with its requests and its words:
 * the sentence and its meaning on one colour block — the partner's hue for a
 * chat's card, as everywhere in v3 — the recordings and the readings, read
 * aloud where the deployment can, the three numbers, the way back to where
 * it came from, Post to the feed, and Remove. The players are the current
 * page's: one per take, with Play again repeating the last one pressed.
 */
export function EchoCardScreenV3({ id }: { id: string }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const card = useEchoCard(id)

  return (
    <Screen fluid ground={v3.colors.bg}>
      <EchoHeaderV3
        title={t('echo.cardTitle')}
        onBack={() => goBackTo('/(app)/echo/cards')}
        trailing={
          card.data ? (
            <Button
              label={t('common.edit')}
              icon="edit-2"
              variant="ink"
              size="small"
              onPress={() => router.push({ pathname: '/(app)/echo/edit', params: { id } })}
              style={styles.auto}
            />
          ) : undefined
        }
      />
      {card.data ? (
        <Card card={card.data} />
      ) : card.isPending && !queryFailed(card) ? (
        <View style={styles.loading}>
          <Skeleton height={160} radius={v3.radius.block} />
          <Skeleton height={52} radius={v3.radius.pill} />
          <Skeleton height={68} radius={v3.radius.card} />
        </View>
      ) : (
        <LoadFailed onRetry={() => void card.refetch()} />
      )}
    </Screen>
  )
}

function Card({ card }: { card: EchoCard }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const names = useDisplayNames()
  const recordings = echoAudiosOf(card)
  const readings = card.voices ?? []
  const due = dueInCompact(card.srs.due, { t })
  const tone = cardTone(card, v3)
  const ink = tone.onHue ? v3.colors.ink : v3.colors.fg

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
      <View style={[styles.block, { backgroundColor: tone.onHue ? tone.fill : v3.colors.surface }]}>
        {card.image ? <Picture key={card.image.url} image={card.image} /> : null}
        {/* The sentence and its meaning. Data, never interface copy. */}
        <Text style={[styles.front, { color: ink }]}>{card.front}</Text>
        {card.reading ? <Text style={[styles.reading, { color: ink }]}>{card.reading}</Text> : null}
        {card.back ? (
          <>
            <View style={[styles.rule, tone.onHue ? styles.ruleOnHue : styles.ruleOnSurface]} />
            <Text style={[styles.back, { color: ink }]}>{card.back}</Text>
          </>
        ) : null}
        {card.example ? <Text style={[styles.example, { color: ink }]}>{card.example}</Text> : null}
      </View>

      {/* People first, then the pack's own readings, as the session draws them. */}
      {recordings.length > 0 || readings.length > 0 ? (
        <PlayAgainProvider>
          <View style={styles.section}>
            <Text style={styles.heading} accessibilityRole="header">
              {t('echo.cardAudio')}
            </Text>
            {recordings.map((audio) => (
              <Recording key={audio.url} audio={audio} hue={recordingHue(card, v3)} />
            ))}
            {readings.map((take) => (
              <Reading key={take.voice} take={take} />
            ))}
            <PlayAgainPill />
          </View>
        </PlayAgainProvider>
      ) : null}
      <ReadAloud card={card} />

      <View style={styles.stats}>
        <Stat label={t('echo.nextReview')} value={due ?? t('echo.dueNow')} />
        <Stat label={t('echo.statReviews')} value={String(card.srs.reps)} />
        <Stat label={t('echo.cardLanguage')} value={names.language(card.lang)} />
      </View>

      <Source card={card} />
      <PostToFeed card={card} />
      <Remove card={card} />
    </ScrollView>
  )
}

/** A chat's recording plays on its partner's hue; the rest on Echo's tint. */
function recordingHue(card: EchoCard, v3: V3Tokens): string {
  return card.source.kind === 'chat'
    ? v3.hues[partnerHueFor(card.source.partnerId)]
    : v3.colors.echoTint
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useStyles()
  return (
    <View style={styles.stat}>
      {/* Two lines, not one: "Due now" is the value a third of a phone wide. */}
      <Text style={styles.statValue} numberOfLines={2}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

/** Where the sentence came from, and the way back to it; nothing for a hand-written card. */
function Source({ card }: { card: EchoCard }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { isRtl } = useLocale()
  const t = useT()
  const partnerId = card.source.kind === 'chat' ? card.source.partnerId : ''
  const profiles = useProfileCache(partnerId ? [partnerId] : [])
  const partner = partnerId ? profiles[partnerId] : undefined

  if (card.source.kind !== 'chat' && card.source.kind !== 'post') return null
  const source = card.source
  const name = partner?.displayName

  return (
    <View style={styles.section}>
      <Text style={styles.heading} accessibilityRole="header">
        {t('echo.cardSource')}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          source.kind === 'chat'
            ? // `params`, never a query string built by hand: `routeLiterals.test.ts`
              // reads an interpolated literal as a wildcard.
              router.push({
                pathname: '/(app)/chat/[id]',
                params: { id: source.conversationId, at: source.messageId },
              })
            : router.push({ pathname: '/(app)/post/[id]', params: { id: source.postId } })
        }
        style={({ pressed }) => [styles.sourceRow, pressed && styles.pressed]}
      >
        {source.kind === 'chat' ? (
          <View
            style={[styles.disc, { backgroundColor: v3.hues[partnerHueFor(source.partnerId)] }]}
          >
            <Text style={styles.discText}>
              {name?.trim().charAt(0).toUpperCase() || t('chat.them').charAt(0).toUpperCase()}
            </Text>
          </View>
        ) : (
          <View style={[styles.disc, styles.discPost]}>
            <Feather name="align-left" size={v3.icon.md} color={v3.colors.fg} />
          </View>
        )}
        <View style={styles.sourceText}>
          <Text style={styles.sourceLabel} numberOfLines={1}>
            {source.kind === 'chat' ? (name ?? t('echo.fromYourChats')) : t('echo.fromAPost')}
          </Text>
          <Text style={styles.sourceSub}>
            {source.kind === 'chat' ? t('echo.sourceOpensChat') : t('echo.sourceOpensPost')}
          </Text>
        </View>
        <Feather
          name={isRtl ? 'chevron-left' : 'chevron-right'}
          size={v3.icon.md}
          color={v3.colors.muted}
        />
      </Pressable>
    </View>
  )
}

/** "Post to the feed", where `echoAskParams` says the card can be one. */
function PostToFeed({ card }: { card: EchoCard }) {
  const t = useT()
  const me = useMe()
  const languages = useMemo(() => postLanguages(me.data?.learning), [me.data])
  const params = echoAskParams(card, languages)
  if (!params) return null

  return (
    <Button
      label={t('echo.postToFeed')}
      icon="send"
      variant="secondary"
      onPress={() => {
        track({ name: 'echo_ask_opened', properties: { kind: 'pronunciation', entry: 'card' } })
        router.push({ pathname: '/(app)/compose', params })
      }}
    />
  )
}

/** Taking the card back, from the card — the list's three calls. */
function Remove({ card }: { card: EchoCard }) {
  const styles = useStyles()
  const t = useT()
  const removeEcho = useRemoveEcho()

  async function confirm(): Promise<void> {
    const yes = await confirmAlert({
      title: t('echo.removeTitle'),
      message: t('echo.removeBody'),
      confirmLabel: t('echo.remove'),
      destructive: true,
    })
    if (!yes) return
    try {
      await removeEcho.mutateAsync({ idOrSourceKey: card._id })
      showToast(t('echo.removed'))
      goBackTo('/(app)/echo/cards')
    } catch {
      await showAlert(t('echo.removeFailedTitle'), t('common.retry'))
    }
  }

  return (
    <View style={styles.removeBlock}>
      <Button
        label={t('echo.removeCard')}
        icon="trash-2"
        variant="danger"
        loading={removeEcho.isPending}
        onPress={() => void confirm()}
      />
      <Text style={styles.removeNote}>{t('echo.removeBody')}</Text>
    </View>
  )
}

/** The picture at its own ratio — see `session.tsx` for why never `cover`. */
function Picture({ image }: { image: EchoImage }) {
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
 * The server voice, for a card that has none yet — offered on the current
 * page's terms (`ReadAloud` in `echo/card/[id].tsx`), with its alerts.
 */
function ReadAloud({ card }: { card: EchoCard }) {
  const t = useT()
  const synthesise = useSynthesiseEchoCard()
  const offered = useAppConfig().data?.voiceService === true

  if (!offered || card.voices?.length || echoSynthVoicesFor(card.lang).length === 0) return null

  async function read(): Promise<void> {
    try {
      await synthesise.mutateAsync({ cardId: card._id })
    } catch (error) {
      if (errorCodeOf(error) === 'QUOTA_EXCEEDED') {
        await showAlert(
          t('echo.limitTitle'),
          t('echo.readAloudLimitBody', { count: PLAN_LIMITS.free.echoVoicesPerDay ?? 0 }),
        )
      } else {
        await showAlert(t('echo.readAloudFailedTitle'), t('common.retry'))
      }
    }
  }

  return (
    <Button
      label={t('echo.readAloud')}
      icon="volume-2"
      variant="secondary"
      loading={synthesise.isPending}
      onPress={() => void read()}
    />
  )
}

/** One recording, its own player: a grey pill with the play disc in the voice's colour. */
function Recording({ audio, hue }: { audio: EchoAudio; hue: string }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const player = useAudioPlayer(audio.url)
  const play = useTakePlay(player)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('echo.play')}
      onPress={() => void play()}
      style={({ pressed }) => [styles.take, pressed && styles.pressed]}
    >
      <View style={[styles.playDisc, { backgroundColor: hue }]}>
        <Feather name="play" size={v3.icon.xs} color={v3.colors.ink} />
      </View>
      <Text style={styles.takeLabel} numberOfLines={1}>
        {audio.speakerName ? t('echo.spokenBy', { name: audio.speakerName }) : t('echo.play')}
      </Text>
    </Pressable>
  )
}

/** A synthesised take — quieter than a person's, as on the session card. */
function Reading({ take }: { take: EchoVoice }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const player = useAudioPlayer(take.url)
  const play = useTakePlay(player)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={voiceLabel(t, take.voice)}
      onPress={() => void play()}
      style={({ pressed }) => [styles.take, pressed && styles.pressed]}
    >
      <View style={[styles.playDisc, styles.playDiscVoice]}>
        <Feather name="cpu" size={v3.icon.xs} color={v3.colors.muted} />
      </View>
      <Text style={styles.voiceLabel} numberOfLines={1}>
        {voiceLabel(t, take.voice)}
      </Text>
    </Pressable>
  )
}

/** Play again, as a pill: absent until a take has played, as `PlayAgainButton` is. */
function PlayAgainPill() {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const last = usePlayAgain()
  if (!last) return null
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('echo.playAgain')}
      onPress={() => void last()}
      style={({ pressed }) => [styles.take, styles.again, pressed && styles.pressed]}
    >
      <Feather name="rotate-ccw" size={v3.icon.md} color={v3.colors.fg} />
      <Text style={styles.takeLabel}>{t('echo.playAgain')}</Text>
    </Pressable>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  auto: { width: 'auto' },
  loading: { gap: v3.space[10], paddingTop: v3.space[6] },
  scroll: { flex: 1 },
  body: { gap: v3.space[10], paddingBottom: v3.space[24], paddingTop: v3.space[6] },
  block: {
    borderRadius: v3.radius.block,
    gap: v3.space[10],
    paddingBottom: v3.space[20],
    paddingHorizontal: v3.space[20],
    paddingTop: v3.space[16],
  },
  picture: {
    borderRadius: v3.radius.row,
    maxHeight: PICTURE_MAX_HEIGHT,
    overflow: 'hidden',
    width: '100%',
  },
  pictureFill: { height: '100%', width: '100%' },
  front: { ...v3.type.title, fontSize: 30 },
  reading: { ...v3.type.callout },
  rule: { borderRadius: 1, height: 2 },
  ruleOnHue: { backgroundColor: 'rgba(20, 22, 27, 0.18)' },
  ruleOnSurface: { backgroundColor: v3.colors.line },
  back: { ...v3.type.body, fontSize: 19, fontWeight: '700', lineHeight: 26 },
  example: { ...v3.type.callout, fontStyle: 'italic' },
  section: { gap: v3.space[8] },
  heading: {
    ...v3.type.button,
    color: v3.colors.fg,
    paddingHorizontal: v3.space[4],
    paddingTop: v3.space[4],
  },
  take: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[10],
    minHeight: 52,
    paddingEnd: v3.space[16],
    paddingStart: v3.space[10],
  },
  again: { alignSelf: 'flex-start', paddingStart: v3.space[14] },
  playDisc: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  playDiscVoice: { backgroundColor: v3.colors.line },
  takeLabel: { ...v3.type.buttonSmall, color: v3.colors.fg, flexShrink: 1 },
  voiceLabel: { ...v3.type.callout, color: v3.colors.muted, flexShrink: 1 },
  stats: { flexDirection: 'row', gap: v3.space[8] },
  stat: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.card,
    flex: 1,
    minWidth: 0,
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[10],
  },
  statValue: { ...v3.type.headline, color: v3.colors.fg },
  statLabel: { ...v3.type.caption, color: v3.colors.muted },
  sourceRow: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 62,
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[10],
  },
  disc: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  discPost: { backgroundColor: v3.colors.line },
  discText: { ...v3.type.buttonSmall, color: v3.colors.ink },
  sourceText: { flex: 1, gap: 1, minWidth: 0 },
  sourceLabel: { ...v3.type.button, color: v3.colors.fg },
  sourceSub: { ...v3.type.caption, color: v3.colors.muted },
  removeBlock: {
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    gap: v3.space[8],
    marginTop: v3.space[8],
    paddingTop: v3.space[16],
  },
  removeNote: { ...v3.type.caption, color: v3.colors.muted, textAlign: 'center' },
  pressed: { opacity: 0.6 },
}))
