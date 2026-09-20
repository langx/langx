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
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useEchoCard, useRemoveEcho, useSynthesiseEchoCard } from '../../../../src/api/queries'
import { LoadFailed } from '../../../../src/components/LoadFailed'
import { Avatar } from '../../../../src/components/ui/Avatar'
import { Button } from '../../../../src/components/ui/Button'
import { Screen } from '../../../../src/components/ui/Screen'
import {
  PlayAgainButton,
  PlayAgainProvider,
  useTakePlay,
} from '../../../../src/components/echo/PlayAgain'
import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader'
import { Skeleton } from '../../../../src/components/ui/Skeleton'
import { useT } from '../../../../src/i18n'
import { useDisplayNames } from '../../../../src/i18n/displayNames'
import { voiceLabel } from '../../../../src/i18n/labels'
import { useAppConfig } from '../../../../src/hooks/useAppConfig'
import { useProfileCache } from '../../../../src/hooks/useProfileCache'
import { confirmAlert, showAlert } from '../../../../src/lib/alert'
import { errorCodeOf } from '../../../../src/lib/errors'
import { dueInCompact } from '../../../../src/lib/format'
import { goBackTo } from '../../../../src/lib/navigation'
import { makeStyles, useTheme } from '../../../../src/lib/theme'
import { showToast } from '../../../../src/lib/toast'

/** As on the session card, and for the same reason: never crop the picture. */
const PICTURE_MAX_HEIGHT = 240

/**
 * One card, as it is — the sentence, what it means, whose voices are on it and
 * when it comes back.
 *
 * Read-only, and the first screen in the module that can be reached by id
 * alone. That is what it is for: a post in the feed links back to the card it
 * was asked from, and until now there was nowhere for that link to go — the
 * editor was fed its card in route params by the list that opened it, so
 * nothing else could open it. Editing is a button away rather than the only
 * way to look at a card.
 */
export default function EchoCardScreen() {
  const styles = useStyles()
  const t = useT()
  const { colors } = useTheme()
  const params = useLocalSearchParams<{ id: string }>()
  const card = useEchoCard(params.id)

  return (
    <Screen scroll>
      <ScreenHeader
        title={t('echo.cardTitle')}
        onBack={() => goBackTo('/(app)/echo/cards')}
        trailing={
          card.data ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.edit')}
              hitSlop={12}
              onPress={() =>
                router.push({ pathname: '/(app)/echo/edit', params: { id: params.id } })
              }
              style={({ pressed }) => (pressed ? styles.pressed : null)}
            >
              <Feather name="edit-2" size={20} color={colors.text} />
            </Pressable>
          ) : undefined
        }
      />
      {card.isPending ? (
        <View style={styles.loading}>
          <Skeleton height={140} />
          <Skeleton height={56} />
        </View>
      ) : card.data ? (
        <Card card={card.data} />
      ) : (
        <LoadFailed onRetry={() => void card.refetch()} />
      )}
    </Screen>
  )
}

function Card({ card }: { card: EchoCard }) {
  const styles = useStyles()
  const t = useT()
  const names = useDisplayNames()
  const recordings = echoAudiosOf(card)
  const readings = card.voices ?? []
  const due = dueInCompact(card.srs.due, { t })

  return (
    <View style={styles.card}>
      {card.image ? <Picture key={card.image.url} image={card.image} /> : null}
      {/* The sentence and its meaning. Data, never interface copy. */}
      <Text style={styles.front}>{card.front}</Text>
      {card.back ? <Text style={styles.back}>{card.back}</Text> : null}
      {card.example ? <Text style={styles.example}>{card.example}</Text> : null}

      {/*
        Both lists, as the session draws them: people first, then the pack's
        own readings. A pack card usually has only the second, and this block
        used to be keyed on the first alone — so the card that most needed a
        voice was the one shown without any.
      */}
      {recordings.length > 0 || readings.length > 0 ? (
        <PlayAgainProvider>
          <View style={styles.block}>
            <Text style={styles.label}>{t('echo.cardAudio')}</Text>
            {recordings.map((audio) => (
              <Recording key={audio.url} audio={audio} />
            ))}
            {readings.map((take) => (
              <Reading key={take.voice} take={take} />
            ))}
            <PlayAgainButton />
          </View>
        </PlayAgainProvider>
      ) : null}
      <ReadAloud card={card} />

      {/*
        The schedule, the work and the language as one strip, the way the tab
        draws its three numbers. They were two label-over-value blocks, which
        is a lot of screen for four words and a date.
      */}
      <View style={styles.stats}>
        <Stat label={t('echo.nextReview')} value={due ?? t('echo.dueNow')} />
        <Stat label={t('echo.statReviews')} value={String(card.srs.reps)} />
        <Stat label={t('echo.cardLanguage')} value={names.language(card.lang)} />
      </View>

      <Source card={card} />
      <Remove card={card} />
    </View>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  const styles = useStyles()
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

/**
 * Where the sentence came from, and the way back to it.
 *
 * The Echo tab used to list the cards made from chats, and tapping one opened
 * the thread at the message. The tab is a stage now and that list has gone, so
 * the link lives here — on the card itself, which is where somebody arriving
 * from the feed or from a search would look for it anyway. A hand-written card
 * has nowhere to go, and says nothing rather than showing a dead row.
 */
function Source({ card }: { card: EchoCard }) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const partnerId = card.source.kind === 'chat' ? card.source.partnerId : ''
  const profiles = useProfileCache(partnerId ? [partnerId] : [])
  const partner = partnerId ? profiles[partnerId] : undefined

  if (card.source.kind !== 'chat' && card.source.kind !== 'post') return null
  const source = card.source

  return (
    <View style={styles.block}>
      <Text style={styles.label}>{t('echo.cardSource')}</Text>
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
          <Avatar
            {...(partner?.avatarUrl ? { url: partner.avatarUrl } : {})}
            name={partner?.displayName ?? t('chat.them')}
            seed={source.partnerId}
            size={40}
          />
        ) : (
          <Feather name="align-left" size={20} color={colors.textFaint} />
        )}
        <Text style={styles.sourceLabel} numberOfLines={1}>
          {source.kind === 'chat'
            ? (partner?.displayName ?? t('echo.fromYourChats'))
            : t('echo.fromAPost')}
        </Text>
        <Feather name="chevron-right" size={18} color={colors.textFaint} />
      </Pressable>
    </View>
  )
}

/**
 * Taking the card back, from the card.
 *
 * The same three calls the list makes, and here because the list is not the
 * only way in any more: a card reached from a post — or from the tab's All
 * cards after a search — could be edited but never removed.
 */
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
    <Button
      label={t('echo.removeCard')}
      variant="secondary"
      loading={removeEcho.isPending}
      onPress={() => void confirm()}
      style={styles.remove}
    />
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
 * The server voice, for a card that has none yet.
 *
 * Offered only where the deployment has the voice service and the model can
 * read the language — `echoSynthVoicesFor` is the same table the API refuses
 * by, so a tap never learns of a limit the screen could have shown. A card
 * that already holds readings shows nothing: the readings are the answer, and
 * the API would return them unchanged. The daily ceiling gets the plain alert
 * every Echo limit gets, which offers nothing to buy.
 */
function ReadAloud({ card }: { card: EchoCard }) {
  const t = useT()
  const synthesise = useSynthesiseEchoCard()
  // Decided by the deployment, not the card: an instance without the voice
  // service answers the route with a 500, and a button that cannot work
  // should not be drawn — the same reason `authProviders` rides on the config.
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
      variant="secondary"
      loading={synthesise.isPending}
      onPress={() => void read()}
    />
  )
}

/** One recording, its own player. As on the session card. */
function Recording({ audio }: { audio: EchoAudio }) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const player = useAudioPlayer(audio.url)
  const play = useTakePlay(player)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('echo.play')}
      hitSlop={8}
      onPress={() => void play()}
      style={({ pressed }) => [styles.speaker, pressed && styles.pressed]}
    >
      <Feather name="volume-2" size={18} color={colors.accent} />
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
  const play = useTakePlay(player)

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

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  loading: { gap: spacing.md, paddingTop: spacing.md },
  card: { gap: spacing.md, paddingTop: spacing.md },
  picture: {
    borderRadius: radius.md,
    maxHeight: PICTURE_MAX_HEIGHT,
    overflow: 'hidden',
    width: '100%',
  },
  pictureFill: { height: '100%', width: '100%' },
  front: { ...font.heading, color: colors.text, fontSize: 24, lineHeight: 32 },
  back: { color: colors.text, fontSize: 17, lineHeight: 24 },
  example: { color: colors.textMuted, fontSize: 15, fontStyle: 'italic' },
  block: { gap: spacing.xs },
  label: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  stats: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: spacing.md,
  },
  statValue: { ...font.heading, color: colors.text, fontSize: 18 },
  statLabel: { color: colors.textFaint, fontSize: 12, textAlign: 'center' },
  sourceRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, paddingVertical: 6 },
  sourceLabel: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '600' },
  remove: { marginTop: spacing.sm },
  speaker: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  speakerLabel: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  /* Quieter than a person's take, as on the session card. */
  voiceLabel: { color: colors.textMuted, fontSize: 14, fontWeight: '500' },
  pressed: { opacity: 0.6 },
}))
