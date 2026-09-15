import Feather from '@expo/vector-icons/Feather'
import { echoAudiosOf, type EchoAudio, type EchoCard, type EchoImage } from '@langx/shared'
import { useAudioPlayer } from 'expo-audio'
import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useEchoCard } from '../../../../src/api/queries'
import { LoadFailed } from '../../../../src/components/LoadFailed'
import { Screen } from '../../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader'
import { Skeleton } from '../../../../src/components/ui/Skeleton'
import { useT } from '../../../../src/i18n'
import { useDisplayNames } from '../../../../src/i18n/displayNames'
import { ensurePlaybackAudioMode } from '../../../../src/lib/audioSession'
import { dueInCompact } from '../../../../src/lib/format'
import { goBackTo } from '../../../../src/lib/navigation'
import { makeStyles, useTheme } from '../../../../src/lib/theme'

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
  const due = dueInCompact(card.srs.due, { t })

  return (
    <View style={styles.card}>
      {card.image ? <Picture key={card.image.url} image={card.image} /> : null}
      {/* The sentence and its meaning. Data, never interface copy. */}
      <Text style={styles.front}>{card.front}</Text>
      {card.back ? <Text style={styles.back}>{card.back}</Text> : null}
      {card.example ? <Text style={styles.example}>{card.example}</Text> : null}

      {recordings.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.label}>{t('echo.cardAudio')}</Text>
          {recordings.map((audio) => (
            <Recording key={audio.url} audio={audio} />
          ))}
        </View>
      ) : null}

      <View style={styles.block}>
        <Text style={styles.label}>{t('echo.cardLanguage')}</Text>
        <Text style={styles.value}>{names.language(card.lang)}</Text>
      </View>
      <View style={styles.block}>
        <Text style={styles.label}>{t('echo.nextReview')}</Text>
        <Text style={styles.value}>{due ? t('echo.dueIn', { time: due }) : t('echo.dueNow')}</Text>
      </View>
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

/** One recording, its own player. As on the session card. */
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
      <Text style={styles.speakerLabel}>
        {audio.speakerName ? t('echo.spokenBy', { name: audio.speakerName }) : t('echo.play')}
      </Text>
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
  value: { color: colors.text, fontSize: 16 },
  speaker: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  speakerLabel: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.6 },
}))
