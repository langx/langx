import Feather from '@expo/vector-icons/Feather'
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import {
  ECHO_GRADES,
  echoAudiosOf,
  type EchoAudio,
  type EchoCard,
  type EchoGrade,
  type EchoImage,
  type EchoVoice,
} from '@langx/shared'
import { useAudioPlayer } from 'expo-audio'
import { useFonts } from 'expo-font'
import { Image } from 'expo-image'
import { useState, type RefObject } from 'react'
import { Animated, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { cardTone } from '../../components/echo/EchoCardsV3Parts'
import { EchoHeaderV3 } from '../../components/echo/EchoHeaderV3'
import {
  PlayAgainButtonV3,
  PlayAgainProvider,
  useAutoplay,
  useTakePlay,
} from '../../components/echo/PlayAgain'
import { Button } from '../../components/ui/Button'
import { EmptyStateV3 } from '../../components/ui/EmptyStateV3'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { Screen } from '../../components/ui/Screen'
import { Skeleton } from '../../components/ui/Skeleton'
import type { useKeyboardClearance } from '../../hooks/useKeyboardClearance'
import { useProfileCache } from '../../hooks/useProfileCache'
import { useT } from '../../i18n'
import { useDisplayNames } from '../../i18n/displayNames'
import { voiceLabel } from '../../i18n/labels'
import type { EchoAskParams } from '../../lib/echoAsk'
import { goBackTo } from '../../lib/navigation'
import { DISPLAY_FONT, makeStyles, useTheme } from '../../lib/theme'

/** As on the current session card, and for the same reason: never crop the picture. */
const PICTURE_MAX_HEIGHT = 240

/** The grade tiles' height, from the drawing: two lines and air, well over any minimum target. */
const GRADE_HEIGHT = 72

export interface EchoSessionV3Props {
  deck: readonly EchoCard[]
  index: number
  card: EchoCard
  producing: boolean
  revealed: boolean
  typed: string
  onType: (text: string) => void
  verdict: 'exact' | 'close' | 'wrong'
  autoplay: boolean
  onToggleAutoplay: () => void
  offline: boolean
  ask: EchoAskParams | null
  onPostToFeed: (params: EchoAskParams) => void
  onReveal: () => void
  onGrade: (grade: EchoGrade) => void
  intervalLabel: (grade: EchoGrade) => string
  keyboard: ReturnType<typeof useKeyboardClearance>
  cardRef: RefObject<ScrollView | null>
}

function back(): void {
  goBackTo('/(app)/(tabs)/echo')
}

/**
 * The review itself in the redesign's look (`V-EchoSession`), behind
 * `flags.v3Home`.
 *
 * Only the drawing. Every piece of state — the frozen deck, the grades held
 * for one batch, the reveal guard, the offline snapshot, autoplay — stays in
 * `app/(app)/echo/session.tsx` and is handed in, so the two looks cannot
 * disagree about what a grade does. `echoSessionV3.test.ts` holds this file
 * to the route's words and roles.
 *
 * The card is one colour block, in the hue of the person it came from as
 * everywhere in v3: who it is from, the sentence, and the takes under it.
 * The answer is a grey block under that, and the grades are four tiles at
 * the foot — Good the one yellow, since Show answer has gone by then.
 */
export function EchoSessionScreenV3(props: EchoSessionV3Props) {
  const { deck, index, producing, revealed, keyboard, cardRef } = props
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()

  return (
    <Screen fluid ground={v3.colors.bg}>
      <Animated.View
        ref={keyboard.frameRef}
        style={[styles.avoid, { paddingBottom: keyboard.pad }]}
      >
        <EchoHeaderV3
          title={t('echo.title')}
          onBack={back}
          meta={t('echo.sessionProgress', { done: index + 1, total: deck.length })}
          trailing={<AutoplaySwitch on={props.autoplay} onToggle={props.onToggleAutoplay} />}
        />
        {props.offline ? (
          /* Said out loud, because the grades will sit on the phone until there
             is a network and somebody should know that before they answer ten. */
          <Text style={styles.offline}>{t('echo.offlineSession')}</Text>
        ) : null}
        <ProgressBar
          value={index / deck.length}
          height={8}
          accessibilityLabel={t('echo.sessionProgress', { done: index, total: deck.length })}
        />
        <ScrollView
          ref={cardRef}
          {...keyboard.scrollProps}
          style={styles.scroll}
          contentContainerStyle={styles.body}
        >
          <CardBlock {...props} />
          {revealed ? <Answer {...props} /> : null}
          {/*
            One way to the feed, in the card body and never in the grade row:
            it is not a grade. Recognition cards only — a production card's
            sentence is the hidden answer. See the route.
          */}
          {!producing && props.ask ? (
            <PostToFeed params={props.ask} onPress={props.onPostToFeed} />
          ) : null}
        </ScrollView>

        <View style={styles.actions}>
          {revealed ? (
            <View style={styles.grades}>
              {ECHO_GRADES.map((value) => (
                <GradeTile
                  key={value}
                  value={value}
                  interval={props.intervalLabel(value)}
                  onPress={() => props.onGrade(value)}
                />
              ))}
            </View>
          ) : (
            // Blue, not yellow: the yellow is Good's, once the answer is up.
            <Button
              variant="blue"
              label={t(producing && props.typed.trim().length > 0 ? 'echo.check' : 'echo.show')}
              onPress={props.onReveal}
            />
          )}
        </View>
      </Animated.View>
    </Screen>
  )
}

/** While the deck is on its way: the header and the card's place. */
export function EchoSessionLoadingV3() {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  return (
    <Screen fluid ground={v3.colors.bg}>
      <EchoHeaderV3 title={t('echo.title')} onBack={back} />
      <View style={styles.loading}>
        <Skeleton height={8} radius={v3.radius.pill} />
        <Skeleton height={220} radius={v3.radius.block} />
      </View>
    </Screen>
  )
}

/** Nothing due: the same two sentences as today, in v3's empty state. */
export function EchoSessionEmptyV3() {
  const { v3 } = useTheme()
  const t = useT()
  return (
    <Screen fluid ground={v3.colors.bg}>
      <EchoHeaderV3 title={t('echo.title')} onBack={back} />
      <EmptyStateV3
        art="cards"
        line={t('echo.sessionEmptyTitle')}
        body={t('echo.sessionEmptyBody')}
      />
    </Screen>
  )
}

/**
 * The speaker at the end of the header row, now with its words on it. One
 * control for the session, not a thing re-decided per card.
 */
function AutoplaySwitch({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const label = t(on ? 'echo.autoplayOn' : 'echo.autoplayOff')
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.autoplay,
        !on && styles.autoplayOff,
        pressed && styles.pressed,
      ]}
    >
      <Feather
        name={on ? 'volume-2' : 'volume-x'}
        size={v3.icon.lg}
        color={on ? v3.colors.echoText : v3.colors.muted}
      />
      <Text style={[styles.autoplayText, !on && styles.autoplayTextOff]}>{label}</Text>
    </Pressable>
  )
}

/** The card: who it is from, the sentence (or, writing it, the meaning and a box), the takes. */
function CardBlock({
  card,
  producing,
  revealed,
  typed,
  onType,
  autoplay,
  keyboard,
}: EchoSessionV3Props) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const names = useDisplayNames()
  const [black] = useFonts({ Nunito_900Black })
  const tone = cardTone(card, v3)
  const fill = tone.onHue ? tone.fill : v3.colors.surface
  const ink = tone.onHue ? v3.colors.ink : v3.colors.fg
  const recordings = echoAudiosOf(card)
  const hearing = !producing || revealed

  return (
    <View style={[styles.block, { backgroundColor: fill }]}>
      <Source card={card} fill={fill} ink={ink} glyph={tone.glyph} />
      {card.image ? <Picture key={card.image.url} image={card.image} /> : null}
      {producing && !revealed ? (
        /*
         * The meaning, and a box. The sentence is the answer, so it is not on
         * screen — and neither are the takes, which would read it out.
         */
        <>
          <Text style={[styles.prompt, { color: ink }]}>
            {t('echo.producePrompt', { language: names.language(card.lang) })}
          </Text>
          <Text style={[styles.front, !black && styles.frontFallback, { color: ink }]}>
            {card.back}
          </Text>
          <TextInput
            value={typed}
            onChangeText={onType}
            {...keyboard.fieldProps()}
            style={styles.input}
            placeholder={t('echo.produceHint')}
            placeholderTextColor={v3.colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            accessibilityLabel={t('echo.produceHint')}
          />
        </>
      ) : (
        /* The sentence as it was written. Data, never interface copy. */
        <Text style={[styles.front, !black && styles.frontFallback, { color: ink }]}>
          {card.front}
        </Text>
      )}
      {/*
        Keyed by card, as today: a new card starts with no take to repeat, and
        two cards sharing a file still mount fresh players.
      */}
      <PlayAgainProvider key={card._id}>
        {hearing ? (
          <View style={styles.takes}>
            {recordings.map((audio, i) => (
              <Recording
                key={`${card._id}:${audio.url}`}
                audio={audio}
                autoplay={autoplay && i === 0}
                onHue={tone.onHue}
                fill={fill}
              />
            ))}
            {(card.voices ?? []).map((take, i) => (
              <Reading
                key={`${card._id}:${take.voice}`}
                take={take}
                autoplay={autoplay && recordings.length === 0 && i === 0}
                ink={ink}
              />
            ))}
            <PlayAgainButtonV3 onHue={tone.onHue} />
          </View>
        ) : null}
      </PlayAgainProvider>
    </View>
  )
}

/** "From Anna" and the card's language, at the top of the block. */
function Source({
  card,
  fill,
  ink,
  glyph,
}: {
  card: EchoCard
  fill: string
  ink: string
  glyph: keyof typeof Feather.glyphMap | null
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const names = useDisplayNames()
  const partnerId = card.source.kind === 'chat' ? card.source.partnerId : ''
  const profiles = useProfileCache(partnerId ? [partnerId] : [])
  const name = partnerId ? profiles[partnerId]?.displayName : undefined
  const language = names.language(card.lang)
  // The cards list's words: "From a post", "Written by you", "From Anna" once
  // the name is in; otherwise just the language, said once.
  const label =
    card.source.kind === 'post'
      ? t('echo.fromAPost')
      : card.source.kind === 'manual'
        ? t('echo.fromYourself')
        : name
          ? t('echo.fromPartner', { name })
          : language

  return (
    <View style={styles.source}>
      <View style={[styles.lead, { backgroundColor: ink }]}>
        {glyph ? (
          <Feather name={glyph} size={v3.icon.xs} color={fill} />
        ) : (
          <Text style={[styles.leadText, { color: fill }]}>
            {name?.trim().charAt(0).toUpperCase() || '·'}
          </Text>
        )}
      </View>
      <Text style={[styles.sourceLabel, { color: ink }]} numberOfLines={1}>
        {label}
      </Text>
      {label !== language ? (
        <Text style={[styles.sourceLang, { color: ink }]} numberOfLines={1}>
          {language}
        </Text>
      ) : null}
    </View>
  )
}

/** The picture at its own ratio — see the route's `CardPicture` for why never `cover`. */
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
 * A person's take: the solid pill, in the block's own colour inverted, so
 * the voice of somebody real is the loudest thing under the sentence.
 */
function Recording({
  audio,
  autoplay,
  onHue,
  fill,
}: {
  audio: EchoAudio
  autoplay: boolean
  onHue: boolean
  fill: string
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const player = useAudioPlayer(audio.url)
  useAutoplay(player, autoplay)
  const play = useTakePlay(player)
  const face = onHue ? v3.colors.ink : v3.colors.pill
  const text = onHue ? fill : v3.colors.pillText

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('echo.play')}
      onPress={() => void play()}
      style={({ pressed }) => [styles.take, { backgroundColor: face }, pressed && styles.pressed]}
    >
      <Feather name="volume-2" size={v3.icon.lg} color={text} />
      {/* Who is speaking, so a person's recording is never taken for anything else. */}
      <Text style={[styles.takeLabel, { color: text }]} numberOfLines={1}>
        {audio.speakerName ? t('echo.spokenBy', { name: audio.speakerName }) : t('echo.play')}
      </Text>
    </Pressable>
  )
}

/** A synthesised take: the outline, quieter than a person's, and labelled by register alone. */
function Reading({ take, autoplay, ink }: { take: EchoVoice; autoplay: boolean; ink: string }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const player = useAudioPlayer(take.url)
  useAutoplay(player, autoplay)
  const play = useTakePlay(player)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={voiceLabel(t, take.voice)}
      onPress={() => void play()}
      style={({ pressed }) => [
        styles.take,
        styles.takeOutline,
        { borderColor: ink },
        pressed && styles.pressed,
      ]}
    >
      <Feather name="cpu" size={v3.icon.lg} color={ink} />
      <Text style={[styles.takeLabel, { color: ink }]} numberOfLines={1}>
        {voiceLabel(t, take.voice)}
      </Text>
    </Pressable>
  )
}

/** The answer, once it is up: the meaning, or what was typed and how close it was. */
function Answer({ card, producing, typed, verdict }: EchoSessionV3Props) {
  const styles = useStyles()
  const t = useT()
  return (
    <View style={styles.answer}>
      {/* Pinyin with the answer rather than above the sentence; see the route. */}
      {card.reading ? <Text style={styles.reading}>{card.reading}</Text> : null}
      {producing ? (
        <>
          <Text style={styles.answerLabel}>{t('echo.yourAnswer')}</Text>
          <Text style={styles.answerText}>{typed.trim() || '—'}</Text>
          {/* Reported, never graded: only the person knows whether they knew it. */}
          <Text style={verdict === 'wrong' ? styles.verdictWrong : styles.verdictOk}>
            {t(
              `echo.verdict${verdict === 'exact' ? 'Exact' : verdict === 'close' ? 'Close' : 'Wrong'}`,
            )}
          </Text>
        </>
      ) : (
        <Text style={styles.answerText}>{card.back}</Text>
      )}
      {card.example ? <Text style={styles.example}>{card.example}</Text> : null}
    </View>
  )
}

function PostToFeed({
  params,
  onPress,
}: {
  params: EchoAskParams
  onPress: (params: EchoAskParams) => void
}) {
  const t = useT()
  return (
    <Button
      variant="secondary"
      size="medium"
      icon="send"
      label={t('echo.postToFeed')}
      onPress={() => onPress(params)}
    />
  )
}

/** One grade: its word and the real interval it schedules. Good is the one yellow. */
function GradeTile({
  value,
  interval,
  onPress,
}: {
  value: EchoGrade
  interval: string
  onPress: () => void
}) {
  const styles = useStyles()
  const t = useT()
  const good = value === 'good'
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.grade, good && styles.gradeGood, pressed && styles.pressed]}
    >
      <Text style={[styles.gradeLabel, good && styles.gradeOnYellow]} numberOfLines={1}>
        {t(`echo.${value}`)}
      </Text>
      <Text style={[styles.gradeInterval, good && styles.gradeOnYellow]} numberOfLines={1}>
        {interval}
      </Text>
    </Pressable>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  avoid: { flex: 1 },
  loading: { gap: v3.space[14] },
  offline: {
    ...v3.type.caption,
    color: v3.colors.muted,
    paddingBottom: v3.space[8],
    textAlign: 'center',
  },
  scroll: { flex: 1 },
  body: { gap: v3.space[10], paddingBottom: v3.space[12], paddingTop: v3.space[14] },
  block: {
    borderRadius: v3.radius.block,
    gap: v3.space[12],
    paddingBottom: v3.space[16],
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[14],
  },
  source: { alignItems: 'center', flexDirection: 'row', gap: v3.space[10] },
  lead: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  leadText: { ...v3.type.label },
  sourceLabel: { ...v3.type.buttonSmall, flex: 1 },
  sourceLang: { ...v3.type.caption, fontWeight: '700', maxWidth: '40%' },
  picture: {
    borderRadius: v3.radius.row,
    maxHeight: PICTURE_MAX_HEIGHT,
    overflow: 'hidden',
    width: '100%',
  },
  pictureFill: { height: '100%', width: '100%' },
  prompt: { ...v3.type.label },
  front: { ...v3.type.title },
  // ExtraBold at Black's size until Black has loaded, as the headers do.
  frontFallback: { fontFamily: DISPLAY_FONT },
  input: {
    ...v3.type.body,
    backgroundColor: v3.colors.bg,
    borderRadius: v3.radius.row,
    color: v3.colors.fg,
    fontWeight: '600',
    minHeight: 56,
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[14],
  },
  takes: { gap: v3.space[8] },
  take: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[10],
    minHeight: 48,
    paddingEnd: v3.space[16],
    paddingStart: v3.space[12],
  },
  takeOutline: { backgroundColor: 'transparent', borderWidth: 2 },
  takeLabel: { ...v3.type.buttonSmall, flexShrink: 1 },
  answer: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.badge,
    gap: v3.space[4],
    paddingHorizontal: v3.space[16],
    paddingVertical: v3.space[14],
  },
  reading: { ...v3.type.callout, color: v3.colors.muted },
  answerLabel: { ...v3.type.label, color: v3.colors.muted },
  answerText: { ...v3.type.body, color: v3.colors.fg, fontWeight: '700' },
  verdictOk: { ...v3.type.callout, color: v3.colors.echoText, fontWeight: '700' },
  verdictWrong: { ...v3.type.callout, color: v3.colors.danger, fontWeight: '700' },
  example: { ...v3.type.callout, color: v3.colors.muted, fontStyle: 'italic' },
  actions: {
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    paddingBottom: v3.space[16],
    paddingTop: v3.space[10],
  },
  grades: { flexDirection: 'row', gap: v3.space[8] },
  grade: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    flex: 1,
    gap: v3.space[2],
    height: GRADE_HEIGHT,
    justifyContent: 'center',
    minWidth: 0,
    paddingHorizontal: v3.space[4],
  },
  gradeGood: { backgroundColor: v3.colors.yellow },
  gradeLabel: { ...v3.type.button, color: v3.colors.fg },
  gradeInterval: { ...v3.type.caption, color: v3.colors.muted, fontWeight: '700' },
  gradeOnYellow: { color: v3.colors.onYellow },
  autoplay: {
    alignItems: 'center',
    backgroundColor: v3.colors.echoTint,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[8],
    minHeight: 44,
    paddingEnd: v3.space[14],
    paddingStart: v3.space[12],
  },
  autoplayOff: { backgroundColor: v3.colors.surface },
  autoplayText: { ...v3.type.buttonSmall, color: v3.colors.echoText },
  autoplayTextOff: { color: v3.colors.muted },
  pressed: { opacity: 0.6 },
}))
