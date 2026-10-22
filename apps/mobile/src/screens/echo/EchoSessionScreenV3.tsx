import Feather from '@expo/vector-icons/Feather'
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import {
  backAddsMeaning,
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
import { useEffect, useState, type ReactNode, type RefObject } from 'react'
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import Reanimated, {
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
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
import { FitText } from '../../components/ui/FitText'
import { PressableScale } from '../../components/ui/PressableScale'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { Screen } from '../../components/ui/Screen'
import { Skeleton } from '../../components/ui/Skeleton'
import type { useKeyboardClearance } from '../../hooks/useKeyboardClearance'
import { useProfileCache } from '../../hooks/useProfileCache'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useLocale, useT } from '../../i18n'
import { useDisplayNames } from '../../i18n/displayNames'
import { voiceLabel } from '../../i18n/labels'
import type { EchoAskParams } from '../../lib/echoAsk'
import { faceAngle, faceOpacity, type FlipFace } from '../../lib/echoFlip'
import { spokenGrade } from '../../lib/format'
import { goBackTo } from '../../lib/navigation'
import { DISPLAY_FONT, makeStyles, useTheme } from '../../lib/theme'
import { PRESS_SCALE_CARD, STAGGER, TIMING, unlessReduced } from '../../lib/theme/motion'

/** As on the current session card, and for the same reason: never crop the picture. */
const PICTURE_MAX_HEIGHT = 240

/** The grade tiles' height, from the drawing: two lines and air, well over any minimum target. */
const GRADE_HEIGHT = 72

/** The back's outline, in the front's colour: the same card, seen from the other side. */
const BACK_BORDER = 3

/**
 * How deep the turn looks. Far enough that the near edge, swelling as it
 * comes towards the reader, stays inside the gutter and is not clipped by the
 * scroll view above the card or drawn under the takes below it.
 */
const FLIP_PERSPECTIVE = 1800

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
  /** Opens the card's edit screen; `null` where the route does not offer it. */
  onEdit: (() => void) | null
  onReveal: () => void
  onGrade: (grade: EchoGrade) => void
  intervalLabel: (grade: EchoGrade) => string
  /** The minutes until the card comes back for each grade, for the spoken label. */
  delayMinutes: (grade: EchoGrade) => number
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
 * everywhere in v3: who it is from and the sentence, with the takes under
 * it. Show answer turns it over: the back is the same card outlined in that
 * hue, the sentence small and the meaning large. The grades are four tiles
 * at the foot — Good the one yellow, since Show answer has gone by then.
 *
 * A card to write keeps its own flow and does not turn: the meaning and the
 * box are its front, and what was typed is checked in a grey block under it.
 */
export function EchoSessionScreenV3(props: EchoSessionV3Props) {
  const { deck, index, producing, revealed, keyboard, cardRef } = props
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const tone = cardTone(props.card, v3)
  // The front's hue, or for a plain grey card a step darker than its grey.
  const edge = tone.onHue ? tone.fill : v3.colors.track

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
          {/*
            Keyed by card, so each new card arrives: it slides in from the
            trailing edge, and the one graded simply goes — nobody watches a
            card they have finished with leave. The first card came in with
            the screen. The key also starts the next card face up, rather
            than turning back.
          */}
          {producing ? (
            <>
              <Arrive key={props.card._id} dx={index > 0 ? 24 : 0}>
                <CardBlock {...props} />
              </Arrive>
              {revealed ? (
                <Arrive dy={12}>
                  <Answer {...props} />
                </Arrive>
              ) : null}
            </>
          ) : (
            <>
              <Arrive key={props.card._id} dx={index > 0 ? 24 : 0}>
                <FlipCard
                  revealed={revealed}
                  // Edit is offered only once the answer is up, which is the
                  // back's moment: on the front it would pop into the row as
                  // the card turned away.
                  front={<CardBlock {...props} onEdit={null} />}
                  back={<CardBack {...props} />}
                  backStyle={[styles.backFace, { borderColor: edge }]}
                />
              </Arrive>
              {/*
                Under the card rather than on a face, so they are there on
                both sides — hearing it again is most use once the meaning is
                up — and one set of players, so a take autoplaying on the
                front plays on while the card turns.
              */}
              <Arrive key={`${props.card._id}:takes`} dx={index > 0 ? 24 : 0}>
                <Takes
                  card={props.card}
                  autoplay={props.autoplay}
                  onHue={false}
                  fill={v3.colors.bg}
                  ink={v3.colors.fg}
                />
              </Arrive>
            </>
          )}
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
              {/*
                Rising a beat apart, and pressable from the first frame: the
                motion is only how they arrive, never something to wait for.
              */}
              {ECHO_GRADES.map((value, order) => (
                <Arrive key={value} dy={8} delay={order * STAGGER} style={styles.gradeSlot}>
                  <GradeTile
                    value={value}
                    interval={props.intervalLabel(value)}
                    minutes={props.delayMinutes(value)}
                    onPress={() => props.onGrade(value)}
                  />
                </Arrive>
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

/**
 * A block arriving once, when it mounts: `dx` points in from the trailing
 * edge (mirrored for right-to-left), or `dy` points up from below, fading in
 * over `TIMING.enter`. Transform and opacity only, started from an effect on
 * the UI thread; with reduce motion the block is simply there.
 */
function Arrive({
  dx = 0,
  dy = 0,
  delay = 0,
  style,
  children,
}: {
  dx?: number
  dy?: number
  delay?: number
  style?: StyleProp<ViewStyle>
  children: ReactNode
}) {
  const reduce = useReduceMotion()
  const { isRtl } = useLocale()
  const still = dx === 0 && dy === 0
  const shown = useSharedValue(reduce || still ? 1 : 0)
  useEffect(() => {
    if (still) return
    shown.set(unlessReduced(reduce, 1, (to) => withDelay(delay, withTiming(to, TIMING.enter))))
  }, [reduce, delay, still, shown])
  const from = isRtl ? -dx : dx
  const motion = useAnimatedStyle(() => {
    const left = 1 - shown.get()
    return {
      opacity: shown.get(),
      transform: [{ translateX: left * from }, { translateY: left * dy }],
    }
  })
  return <Reanimated.View style={[style, motion]}>{children}</Reanimated.View>
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
      {/*
        One line, shrinking: "Reproducción automática desactivada" is wider
        than the room beside the chevron on a 390pt phone, and a wrapped pill
        pushes the title down every time autoplay is switched.
      */}
      <FitText style={[styles.autoplayText, !on && styles.autoplayTextOff]} minimumFontScale={0.75}>
        {label}
      </FitText>
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
  onEdit,
}: EchoSessionV3Props) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const names = useDisplayNames()
  const [black] = useFonts({ Nunito_900Black })
  const tone = cardTone(card, v3)
  const fill = tone.onHue ? tone.fill : v3.colors.surface
  const ink = tone.onHue ? v3.colors.ink : v3.colors.fg

  return (
    <View style={[styles.block, styles.blockFill, { backgroundColor: fill }]}>
      <Source card={card} fill={fill} ink={ink} glyph={tone.glyph} onEdit={onEdit} />
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
        On the card only for a card to write, and only once it is checked:
        before that they would read the answer out. A card to recognise has
        them under the card instead, on neither face.
      */}
      {producing && revealed ? (
        <Takes card={card} autoplay={autoplay} onHue={tone.onHue} fill={fill} ink={ink} />
      ) : null}
    </View>
  )
}

/**
 * The card's two faces and the turn between them, on the UI thread.
 *
 * Both faces stay mounted, stacked, and turn together through 180°; each is
 * see-through outside its own half of the turn, so the swap happens at 90°,
 * edge-on, and no text is ever seen from behind (`lib/echoFlip`). With
 * reduced motion the faces crossfade in place instead of turning.
 *
 * The front is in the flow and the back lies over it, and the front is held
 * at least as tall as the back: the card is the height of its taller face
 * before the turn and after it, so nothing under it jumps at the swap, and a
 * long sentence or a long meaning has its room on either side.
 */
function FlipCard({
  revealed,
  front,
  back,
  backStyle,
}: {
  revealed: boolean
  front: ReactNode
  back: ReactNode
  backStyle: StyleProp<ViewStyle>
}) {
  const styles = useStyles()
  const reduce = useReduceMotion()
  const progress = useSharedValue(revealed ? 1 : 0)
  // `null` until the back has been measured: until then the card is not
  // drawn, so it never shows at the front's own height and then grows.
  const [backHeight, setBackHeight] = useState<number | null>(null)

  useEffect(() => {
    // A crossfade when motion is reduced, not the cut `unlessReduced` makes:
    // a cut here reads as one card swapped for another rather than turned.
    // `ReduceMotion.Never` on it, because Reanimated's own default skips every
    // animation to its end under the system setting, crossfade included.
    progress.set(
      withTiming(
        revealed ? 1 : 0,
        reduce ? { ...TIMING.crossfade, reduceMotion: ReduceMotion.Never } : TIMING.flip,
      ),
    )
  }, [revealed, reduce, progress])

  const frontMotion = useAnimatedStyle(() => faceMotion('front', progress.get(), reduce))
  const backMotion = useAnimatedStyle(() => faceMotion('back', progress.get(), reduce))

  return (
    <View style={backHeight === null && styles.unmeasured}>
      <Reanimated.View
        aria-hidden={revealed}
        style={[{ minHeight: backHeight ?? 0 }, frontMotion, revealed && styles.faceAway]}
      >
        {front}
      </Reanimated.View>
      <Reanimated.View
        aria-hidden={!revealed}
        style={[StyleSheet.absoluteFill, backStyle, backMotion, !revealed && styles.faceAway]}
      >
        {/* Measured at its own height, not the card's: what the front is held to. */}
        <View
          onLayout={({ nativeEvent }) => setBackHeight(nativeEvent.layout.height + 2 * BACK_BORDER)}
        >
          {back}
        </View>
      </Reanimated.View>
    </View>
  )
}

function faceMotion(face: FlipFace, progress: number, reduce: boolean) {
  'worklet'
  return {
    opacity: faceOpacity(face, progress, reduce),
    transform: [
      { perspective: FLIP_PERSPECTIVE },
      { rotateY: `${faceAngle(face, progress, reduce)}deg` },
    ],
  }
}

/**
 * The back: who it is from, the sentence again but small, and the meaning as
 * large as the sentence was on the front — or the note that the card has no
 * meaning yet, under the Edit that gives it one.
 */
function CardBack({ card, onEdit }: EchoSessionV3Props) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const [black] = useFonts({ Nunito_900Black })
  const tone = cardTone(card, v3)

  return (
    <View style={styles.block}>
      <Source
        card={card}
        fill={v3.colors.bg}
        ink={v3.colors.fg}
        glyph={tone.glyph}
        onEdit={onEdit}
      />
      {/* The sentence as it was written. Data, never interface copy. */}
      <Text style={styles.backSentence}>{card.front}</Text>
      <View style={styles.backRule} />
      {/* Pinyin with the answer rather than above the sentence; see the route. */}
      {card.reading ? <Text style={styles.reading}>{card.reading}</Text> : null}
      {backAddsMeaning(card.front, card.back) ? (
        <Text style={[styles.front, styles.meaning, !black && styles.frontFallback]}>
          {card.back}
        </Text>
      ) : (
        /*
         * An empty back, or one that is the sentence again — what a
         * translation into the language it is already in returns. Showing the
         * front twice read as a card with no back side at all; saying so
         * points at the card's Edit instead.
         */
        <Text style={styles.noMeaning}>{t('echo.noMeaningYet')}</Text>
      )}
      {card.example ? <Text style={styles.example}>{card.example}</Text> : null}
    </View>
  )
}

/**
 * The card's takes — a person's recordings first, then the readings — and
 * Play again under them. Autoplay starts the first.
 */
function Takes({
  card,
  autoplay,
  onHue,
  fill,
  ink,
}: {
  card: EchoCard
  autoplay: boolean
  onHue: boolean
  fill: string
  ink: string
}) {
  const styles = useStyles()
  const recordings = echoAudiosOf(card)
  return (
    /*
      Keyed by card, as today: a new card starts with no take to repeat, and
      two cards sharing a file still mount fresh players.
    */
    <PlayAgainProvider key={card._id}>
      <View style={styles.takes}>
        {recordings.map((audio, i) => (
          <Recording
            key={`${card._id}:${audio.url}`}
            audio={audio}
            autoplay={autoplay && i === 0}
            onHue={onHue}
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
        <PlayAgainButtonV3 onHue={onHue} />
      </View>
    </PlayAgainProvider>
  )
}

/** "From Anna" and the card's language, at the top of the block. */
function Source({
  card,
  fill,
  ink,
  glyph,
  onEdit,
}: {
  card: EchoCard
  fill: string
  ink: string
  glyph: keyof typeof Feather.glyphMap | null
  onEdit: (() => void) | null
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
  // the name is in. Until then — and offline, where it may never come — "From
  // your chats", which is true of every chat card and does not repeat the
  // language beside it.
  const label =
    card.source.kind === 'post'
      ? t('echo.fromAPost')
      : card.source.kind === 'manual'
        ? t('echo.fromYourself')
        : name
          ? t('echo.fromPartner', { name })
          : card.source.kind === 'chat'
            ? t('echo.fromYourChats')
            : language

  return (
    <View style={styles.source}>
      <View style={[styles.lead, { backgroundColor: ink }]}>
        {glyph ? (
          <Feather name={glyph} size={v3.icon.xs} color={fill} />
        ) : name?.trim() ? (
          <Text style={[styles.leadText, { color: fill }]}>
            {name.trim().charAt(0).toUpperCase()}
          </Text>
        ) : (
          // No initial yet: the chat bubble says where the card came from, where "·" said nothing.
          <Feather name="message-circle" size={v3.icon.xs} color={fill} />
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
      {onEdit ? (
        /*
         * In the card's own top row, beside who it is from: it is about this
         * card, and it is not a grade, so it stays out of the row at the foot.
         */
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('echo.editTitle')}
          hitSlop={8}
          onPress={onEdit}
          style={({ pressed }) => [styles.edit, { borderColor: ink }, pressed && styles.pressed]}
        >
          <Feather name="edit-2" size={v3.icon.xs} color={ink} />
          <Text style={[styles.editText, { color: ink }]} numberOfLines={1}>
            {t('common.edit')}
          </Text>
        </Pressable>
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

/** A written card's check, once it is up: what was typed and how close it was. */
function Answer({ card, typed, verdict }: EchoSessionV3Props) {
  const styles = useStyles()
  const t = useT()
  return (
    <View style={styles.answer}>
      {/* Pinyin with the answer rather than above the sentence; see the route. */}
      {card.reading ? <Text style={styles.reading}>{card.reading}</Text> : null}
      <Text style={styles.answerLabel}>{t('echo.yourAnswer')}</Text>
      <Text style={styles.answerText}>{typed.trim() || '—'}</Text>
      {/* Reported, never graded: only the person knows whether they knew it. */}
      <Text style={verdict === 'wrong' ? styles.verdictWrong : styles.verdictOk}>
        {t(
          `echo.verdict${verdict === 'exact' ? 'Exact' : verdict === 'close' ? 'Close' : 'Wrong'}`,
        )}
      </Text>
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
  minutes,
  onPress,
}: {
  value: EchoGrade
  interval: string
  minutes: number
  onPress: () => void
}) {
  const styles = useStyles()
  const t = useT()
  const good = value === 'good'
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={spokenGrade(t, t(`echo.${value}`), minutes)}
      onPress={onPress}
      scaleTo={PRESS_SCALE_CARD}
      style={[styles.grade, good && styles.gradeGood]}
    >
      {/*
        Shrinks rather than truncates: four tiles on a 375pt phone leave about
        70pt for "Difficile" or "Хорошо", and an ellipsis on a grade hides
        which grade it is.
      */}
      <FitText style={[styles.gradeLabel, good && styles.gradeOnYellow]} minimumFontScale={0.7}>
        {t(`echo.${value}`)}
      </FitText>
      <Text style={[styles.gradeInterval, good && styles.gradeOnYellow]} numberOfLines={1}>
        {interval}
      </Text>
    </PressableScale>
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
  // The front fills its face, which is held to the back's height.
  blockFill: { flexGrow: 1 },
  // The face turned away takes no touches: its Edit lies under the other face's.
  faceAway: { pointerEvents: 'none' },
  unmeasured: { opacity: 0 },
  backFace: {
    backgroundColor: v3.colors.bg,
    borderRadius: v3.radius.block,
    borderWidth: BACK_BORDER,
  },
  backSentence: { ...v3.type.headline, color: v3.colors.muted },
  backRule: { backgroundColor: v3.colors.line, height: 2 },
  meaning: { color: v3.colors.fg },
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
  noMeaning: { ...v3.type.body, color: v3.colors.muted },
  edit: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    flexDirection: 'row',
    flexShrink: 0,
    gap: v3.space[4],
    minHeight: 32,
    paddingHorizontal: v3.space[10],
  },
  editText: { ...v3.type.caption, fontWeight: '700' },
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
  gradeSlot: { flex: 1, minWidth: 0 },
  grade: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
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
    flexShrink: 1,
    gap: v3.space[8],
    minHeight: 44,
    paddingEnd: v3.space[14],
    paddingStart: v3.space[12],
  },
  autoplayOff: { backgroundColor: v3.colors.surface },
  autoplayText: { ...v3.type.buttonSmall, color: v3.colors.echoText, flexShrink: 1 },
  autoplayTextOff: { color: v3.colors.muted },
  pressed: { opacity: 0.6 },
}))
