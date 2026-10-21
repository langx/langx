import Feather from '@expo/vector-icons/Feather'
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import { useFonts } from 'expo-font'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useRef, type ComponentProps } from 'react'
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useT } from '../../i18n'
import type { CallState } from '../../lib/calls/machine'
import {
  declineCall,
  dismissCall,
  hangUp,
  setCallMinimized,
  toggleMicrophone,
} from '../../lib/calls/session'
import { makeStyles, useTheme } from '../../lib/theme'
import { partnerHueFor } from '../../lib/theme/partnerHue'
import { Avatar } from '../ui/Avatar'
import { CallVideoView } from './CallVideoView'
import { askCallFeedback, CAN_FLIP, goToCallFeedback, useCallScreen } from './useCallScreen'

type IconName = ComponentProps<typeof Feather>['name']

/**
 * The call screen in v3's look, behind `flags.v3Home`.
 *
 * Everything it does is `useCallScreen`'s, shared with the current look: the
 * same presses, the same stage, the same line under the name. Only the drawing
 * is new. A voice call — and a video call whose picture is not up yet — sits
 * on the partner's hue, the block that heads their thread, so the call reads
 * as part of that conversation. A picture gets the dark stage it needs, with
 * the controls in a dark panel under it. Controls are labelled tiles; the
 * state that needs noticing (a muted mic, the camera off, the speaker on) is
 * drawn inverted, as the current look's `lit` disc is. Red ends a call, and
 * yellow appears only on Answer.
 */
export function CallScreenV3({ call }: { call: CallState }) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const insets = useSafeAreaInsets()
  // The name is Nunito Black, which the root does not load
  // (`DISPLAY_FONT_BLACK`). Nothing waits on it, as in the thread's header.
  useFonts({ Nunito_900Black })
  const {
    streams,
    remoteFit,
    answering,
    front,
    speaker,
    name,
    status,
    up,
    video,
    theirs,
    mineOnStage,
    mineInTile,
    picture,
    answer,
    camera,
    flip,
    toggleSpeaker,
  } = useCallScreen(call)
  const hue = v3.hues[partnerHueFor(call.peer._id)]
  const ended = call.phase === 'ended'
  const reconnecting = call.phase === 'active' && call.reconnecting

  // Only while the call can get out of the way. A ringing call has a decision
  // to make and gets no detour; the closing screen asks for feedback on the
  // page itself, below.
  const topBar = up ? (
    <View style={styles.topBar}>
      <Chip
        icon="chevron-down"
        label={t('calls.minimize')}
        onStage={picture}
        onPress={() => setCallMinimized(true)}
      />
      <View style={styles.spacer} />
      <BetaFeedback onStage={picture} hue={hue} />
    </View>
  ) : null

  const notes = (
    <>
      {up && !call.remoteMicOn ? (
        <Note icon="mic-off" text={t('calls.peerMuted', { name })} onStage={picture} />
      ) : null}
      {video && call.phase === 'active' && !call.remoteCameraOn ? (
        <Note icon="video-off" text={t('calls.peerCameraOff')} onStage={picture} />
      ) : null}
    </>
  )

  /** The switches of a call that is up, as tiles: light on the ground, dark in the panel. */
  const tiles = up ? (
    <View style={styles.tiles}>
      <Tile
        icon={call.micOn ? 'mic' : 'mic-off'}
        label={t(call.micOn ? 'calls.mute' : 'calls.unmute')}
        lit={!call.micOn}
        dark={picture}
        onPress={toggleMicrophone}
      />
      {video ? (
        <Tile
          icon={call.cameraOn ? 'video' : 'video-off'}
          label={t(call.cameraOn ? 'calls.cameraOff' : 'calls.cameraOn')}
          caption={t('calls.tile.camera')}
          lit={!call.cameraOn}
          dark={picture}
          onPress={() => void camera()}
        />
      ) : null}
      {video && call.cameraOn && CAN_FLIP ? (
        <Tile
          icon="refresh-cw"
          label={t('calls.flipCamera')}
          caption={t('calls.tile.flip')}
          dark={picture}
          onPress={flip}
        />
      ) : null}
      {Platform.OS !== 'web' ? (
        <Tile
          icon="volume-2"
          label={t('calls.speaker')}
          lit={speaker}
          dark={picture}
          onPress={toggleSpeaker}
        />
      ) : null}
    </View>
  ) : null

  const controls =
    call.phase === 'incoming' ? (
      <>
        <View style={styles.pair}>
          <Pill
            icon="phone-off"
            label={t('calls.decline')}
            tone="hangUp"
            onPress={declineCall}
            style={styles.half}
          />
          <Pill
            icon={video ? 'video' : 'phone'}
            label={t('calls.answer')}
            tone="answer"
            disabled={answering}
            onPress={() => void answer(true)}
            style={styles.half}
          />
        </View>
        {video ? (
          <Pill
            icon="video-off"
            label={t('calls.answerNoCamera')}
            tone="outline"
            disabled={answering}
            onPress={() => void answer(false)}
          />
        ) : null}
      </>
    ) : call.phase === 'outgoing' ? (
      <Pill icon="phone-off" label={t('calls.cancel')} tone="hangUp" onPress={hangUp} />
    ) : up ? (
      <>
        {tiles}
        <Pill icon="phone-off" label={t('calls.hangUp')} tone="hangUp" onPress={hangUp} />
      </>
    ) : null

  if (picture) {
    return (
      <View style={styles.stage}>
        <StatusBar style="light" />
        {theirs ? (
          <View style={styles.fill}>
            <CallVideoView stream={streams.remote} revision={streams.revision} fit={remoteFit} />
          </View>
        ) : mineOnStage ? (
          <View style={styles.fill}>
            <CallVideoView
              stream={streams.local}
              revision={streams.revision}
              fit="cover"
              mirrored={front}
            />
          </View>
        ) : null}
        <View style={[styles.column, { paddingTop: insets.top }]}>
          {topBar}
          {/* Over a picture the name is a caption, on a scrim so a bright room cannot wash it out. */}
          <View style={styles.caption}>
            <Text style={styles.captionName} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.captionStatus} numberOfLines={1} accessibilityLiveRegion="polite">
              {status}
            </Text>
          </View>
          <View style={styles.notes}>{notes}</View>
          <View style={styles.spacer} />
          {mineInTile ? (
            <View style={styles.selfTile}>
              <CallVideoView
                stream={streams.local}
                revision={streams.revision}
                fit="cover"
                mirrored={front}
              />
            </View>
          ) : null}
          <View style={[styles.panel, { paddingBottom: insets.bottom + v3.space[24] }]}>
            {controls}
          </View>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.ground}>
      {/* Every hue is light in both schemes, so the status bar's glyphs go dark over it. */}
      <StatusBar style="dark" />
      <View
        style={[
          styles.hueBlock,
          ended && styles.hueBlockEnded,
          { backgroundColor: hue, paddingTop: insets.top },
        ]}
      >
        {topBar ?? <View style={styles.topBarRoom} />}
        <View style={styles.identity}>
          <RingingAvatar call={call} faded={reconnecting} />
          <View style={styles.names}>
            <Text style={[styles.name, ended && styles.nameEnded]} numberOfLines={1}>
              {name}
            </Text>
            {reconnecting ? (
              <>
                <View style={styles.reconnecting} accessibilityLiveRegion="polite">
                  <Feather name="bar-chart" size={v3.icon.md} color={hue} />
                  <Text style={[styles.reconnectingText, { color: hue }]}>{status}</Text>
                </View>
                <Text style={styles.subline}>{t('calls.reconnectingHint')}</Text>
              </>
            ) : (
              <Text
                style={[
                  styles.status,
                  call.phase === 'active' && styles.clock,
                  ended && styles.closing,
                ]}
                accessibilityLiveRegion="polite"
              >
                {status}
              </Text>
            )}
            {call.phase === 'outgoing' ? (
              <Text style={styles.subline}>{t(video ? 'calls.videoCall' : 'calls.voiceCall')}</Text>
            ) : null}
          </View>
          {notes}
        </View>
        {mineInTile ? (
          <View style={[styles.selfTile, styles.selfTileOnHue]}>
            <CallVideoView
              stream={streams.local}
              revision={streams.revision}
              fit="cover"
              mirrored={front}
            />
          </View>
        ) : null}
      </View>
      <View
        style={[
          styles.foot,
          ended && styles.footEnded,
          { paddingBottom: insets.bottom + v3.space[24] },
        ]}
      >
        {ended ? <ClosingFeedback /> : controls}
      </View>
    </View>
  )
}

/**
 * The closing screen's foot: the Beta pill's question asked on the page, and
 * OK. The choices go where the pill's do; OK closes the line, as it always has.
 */
function ClosingFeedback() {
  const t = useT()
  const styles = useStyles()
  return (
    <>
      <View style={styles.askHead}>
        <Text style={styles.askBadge}>{t('calls.beta')}</Text>
        <Text style={styles.askTitle} accessibilityRole="header">
          {t('calls.howWasIt')}
        </Text>
      </View>
      <Text style={styles.askBody}>{t('calls.feedbackBody')}</Text>
      <Pill
        icon="alert-circle"
        label={t('feedback.bugTitle')}
        tone="quiet"
        onPress={() => goToCallFeedback('bug', true)}
      />
      <Pill
        icon="zap"
        label={t('feedback.featureTitle')}
        tone="quiet"
        onPress={() => goToCallFeedback('feature', true)}
      />
      <View style={styles.spacer} />
      <Pill icon="check" label={t('common.ok')} tone="ok" onPress={dismissCall} />
    </>
  )
}

/**
 * Their face, inside two rings. While the call waits on somebody the outer
 * ring breathes — "this is still happening", for the forty-five seconds a ring
 * can last; anybody who asked for less motion gets the rings standing still.
 * Once the call is up the rings go and the face is all there is.
 */
function RingingAvatar({ call, faded }: { call: CallState; faded: boolean }) {
  const styles = useStyles()
  const reduceMotion = useReduceMotion()
  const waiting = call.phase === 'incoming' || call.phase === 'outgoing'
  const pulse = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!waiting || reduceMotion) {
      pulse.setValue(0)
      return
    }
    const loop = Animated.loop(
      Animated.timing(pulse, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    )
    loop.start()
    return () => loop.stop()
  }, [waiting, reduceMotion, pulse])

  const face = (
    <View style={faded && styles.faded}>
      <Avatar
        url={call.peer.avatarUrl}
        name={call.peer.displayName}
        seed={call.peer._id}
        size={waiting ? FACE_RINGING : call.phase === 'ended' ? FACE_ENDED : FACE}
      />
    </View>
  )
  if (!waiting) return face

  return (
    <View style={styles.rings}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ringOuter,
          reduceMotion
            ? null
            : {
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }),
                transform: [
                  { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.04] }) },
                ],
              },
        ]}
      />
      <View pointerEvents="none" style={styles.ringInner} />
      {face}
    </View>
  )
}

/** The round chip in the stage's top corner: Hide call. */
function Chip({
  icon,
  label,
  onStage,
  onPress,
}: {
  icon: IconName
  label: string
  onStage: boolean
  onPress: () => void
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        onStage && styles.chipOnStage,
        pressed && styles.pressed,
      ]}
    >
      <Feather name={icon} size={v3.icon.lg} color={onStage ? v3.colors.onSignal : v3.colors.ink} />
    </Pressable>
  )
}

/**
 * Calls are new, and the screen says so — with the way to tell us beside it.
 * The same pill and the same question as the current look's.
 */
function BetaFeedback({ onStage, hue }: { onStage: boolean; hue: string }) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const fg = onStage ? v3.colors.onSignal : v3.colors.ink
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('calls.beta')} · ${t('calls.feedback')}`}
      hitSlop={8}
      onPress={() => void askCallFeedback(t, false)}
      style={({ pressed }) => [
        styles.beta,
        onStage && styles.chipOnStage,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.betaBadge,
          onStage
            ? { backgroundColor: v3.colors.onSignal, color: v3.colors.ink }
            : { backgroundColor: v3.colors.ink, color: hue },
        ]}
      >
        {t('calls.beta')}
      </Text>
      <Feather name="message-square" size={v3.icon.sm} color={fg} />
      <Text style={[styles.betaLabel, { color: fg }]}>{t('calls.feedback')}</Text>
    </Pressable>
  )
}

function Note({ icon, text, onStage }: { icon: IconName; text: string; onStage: boolean }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const fg = onStage ? v3.colors.onSignal : v3.colors.ink
  return (
    <View style={[styles.note, onStage && styles.chipOnStage]}>
      <Feather name={icon} size={v3.icon.xs} color={fg} />
      <Text style={[styles.noteText, { color: fg }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  )
}

/**
 * One switch, as a labelled tile. `lit` is a switch in the state that needs
 * noticing — drawn inverted, the current look's rule. `caption` is the short
 * word under the glyph when the full label would not fit a quarter of the
 * row; the full label is what a screen reader hears either way.
 */
function Tile({
  icon,
  label,
  caption,
  lit = false,
  dark,
  onPress,
}: {
  icon: IconName
  label: string
  caption?: string
  lit?: boolean
  /** In the video panel, where the tiles are the dark stage's. */
  dark: boolean
  onPress: () => void
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const fg = dark
    ? lit
      ? v3.colors.ink
      : v3.colors.onSignal
    : lit
      ? v3.colors.pillText
      : v3.colors.fg
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: lit }}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        dark && styles.tileDark,
        lit && (dark ? styles.tileDarkLit : styles.tileLit),
        pressed && styles.pressed,
      ]}
    >
      <Feather name={icon} size={v3.icon.xl} color={fg} />
      <Text
        style={[styles.tileLabel, { color: fg }]}
        numberOfLines={2}
        importantForAccessibility="no"
        accessibilityElementsHidden
      >
        {caption ?? label}
      </Text>
    </Pressable>
  )
}

/**
 * A full-width call action. `hangUp` is the red for every way out — Hang up,
 * Cancel, Decline; `answer` the screen's one yellow; `outline` Answer without
 * camera; `quiet` the grey feedback choices; `ok` the blue that closes the line.
 */
function Pill({
  icon,
  label,
  tone,
  onPress,
  disabled = false,
  style,
}: {
  icon: IconName
  label: string
  tone: 'hangUp' | 'answer' | 'outline' | 'quiet' | 'ok'
  onPress: () => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const face = {
    hangUp: styles.pillHangUp,
    answer: styles.pillAnswer,
    outline: styles.pillOutline,
    quiet: styles.pillQuiet,
    ok: styles.pillOk,
  }[tone]
  const fg = {
    hangUp: v3.colors.onSignal,
    answer: v3.colors.onYellow,
    outline: v3.colors.fg,
    quiet: v3.colors.fg,
    ok: v3.colors.onBlue,
  }[tone]
  const big = tone === 'hangUp' || tone === 'answer'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pill,
        big && styles.pillBig,
        face,
        style,
        (pressed || disabled) && styles.pressed,
      ]}
    >
      <Feather name={icon} size={v3.icon.lg} color={fg} />
      <Text style={[big ? styles.pillLabelBig : styles.pillLabel, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

const FACE_RINGING = 132
const FACE = 120
const FACE_ENDED = 104
const RING_INNER = 168
const RING_OUTER = 212

const useStyles = makeStyles(({ v3 }) => ({
  ground: { backgroundColor: v3.colors.bg, flex: 1 },
  // The video stage is dark in both schemes, as the photo viewer is: this is
  // somebody's picture, not a sheet of the app's own.
  stage: { backgroundColor: v3.colors.ink, flex: 1 },
  fill: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  column: { flex: 1 },
  spacer: { flex: 1 },
  pressed: { opacity: 0.8 },
  faded: { opacity: 0.55 },

  hueBlock: {
    borderBottomLeftRadius: v3.radius.hero,
    borderBottomRightRadius: v3.radius.hero,
    flex: 1,
    paddingBottom: v3.space[32],
  },
  hueBlockEnded: { flex: 0, minHeight: 400 },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[12],
    paddingHorizontal: v3.space[12],
    paddingTop: v3.space[10],
  },
  topBarRoom: { height: 58 },
  identity: {
    alignItems: 'center',
    flex: 1,
    gap: v3.space[20],
    justifyContent: 'center',
    paddingHorizontal: v3.space[24],
  },
  names: { alignItems: 'center', gap: v3.space[6], maxWidth: 420 },
  name: { ...v3.type.display, color: v3.colors.ink, textAlign: 'center' },
  nameEnded: { ...v3.type.title },
  status: {
    ...v3.type.buttonSmall,
    color: v3.colors.ink,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  clock: { ...v3.type.headline },
  // The closing line is the one thing on the screen then, so it is read at
  // the size of a heading rather than as the meta it was a moment ago.
  closing: { ...v3.type.headline },
  subline: { ...v3.type.callout, color: v3.colors.ink, textAlign: 'center', maxWidth: 300 },
  reconnecting: {
    alignItems: 'center',
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[8],
    minHeight: 44,
    paddingHorizontal: v3.space[16],
  },
  reconnectingText: { ...v3.type.buttonSmall },

  rings: {
    alignItems: 'center',
    height: RING_OUTER,
    justifyContent: 'center',
    width: RING_OUTER,
  },
  ringOuter: {
    borderColor: v3.colors.hueRingFaint,
    borderRadius: RING_OUTER / 2,
    borderWidth: 2,
    height: RING_OUTER,
    position: 'absolute',
    width: RING_OUTER,
  },
  ringInner: {
    borderColor: v3.colors.hueRing,
    borderRadius: RING_INNER / 2,
    borderWidth: 2,
    height: RING_INNER,
    position: 'absolute',
    width: RING_INNER,
  },

  chip: {
    alignItems: 'center',
    backgroundColor: v3.colors.hueWash,
    borderRadius: v3.radius.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  chipOnStage: { backgroundColor: v3.colors.stageScrim },
  beta: {
    alignItems: 'center',
    backgroundColor: v3.colors.hueWash,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[8],
    minHeight: 48,
    paddingEnd: v3.space[16],
    paddingStart: v3.space[6],
  },
  betaBadge: {
    ...v3.type.label,
    borderRadius: v3.radius.pill,
    overflow: 'hidden',
    paddingHorizontal: v3.space[10],
    paddingVertical: v3.space[8],
    textTransform: 'uppercase',
  },
  betaLabel: { ...v3.type.buttonSmall },
  note: {
    alignItems: 'center',
    backgroundColor: v3.colors.hueWash,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[6],
    maxWidth: 320,
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[6],
  },
  noteText: { ...v3.type.callout, flexShrink: 1 },

  caption: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: v3.colors.stageScrim,
    borderRadius: v3.radius.card,
    marginTop: v3.space[10],
    maxWidth: 420,
    paddingHorizontal: v3.space[20],
    paddingVertical: v3.space[8],
  },
  captionName: { ...v3.type.headline, color: v3.colors.onSignal },
  captionStatus: {
    ...v3.type.buttonSmall,
    color: v3.colors.onSignal,
    fontVariant: ['tabular-nums'],
  },
  notes: { alignItems: 'center', gap: v3.space[8], marginTop: v3.space[12] },
  // The viewer's own picture, small, above the controls and out of the way
  // of the face it is drawn over.
  selfTile: {
    alignSelf: 'flex-end',
    backgroundColor: v3.colors.stageScrim,
    borderColor: v3.colors.onSignal,
    borderRadius: v3.radius.card,
    borderWidth: 2,
    height: 152,
    marginBottom: v3.space[12],
    marginEnd: v3.space[16],
    overflow: 'hidden',
    width: 108,
  },
  selfTileOnHue: { marginBottom: 0 },
  panel: {
    backgroundColor: v3.colors.ink,
    borderTopLeftRadius: v3.radius.hero,
    borderTopRightRadius: v3.radius.hero,
    gap: v3.space[12],
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[16],
  },
  foot: {
    gap: v3.space[12],
    paddingHorizontal: v3.space[20],
    paddingTop: v3.space[20],
  },
  footEnded: { flex: 1 },
  tiles: { flexDirection: 'row', gap: v3.space[8] },
  tile: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.badge,
    flex: 1,
    gap: v3.space[6],
    justifyContent: 'center',
    minHeight: 84,
    minWidth: 0,
    paddingHorizontal: v3.space[4],
    paddingVertical: v3.space[8],
  },
  tileLit: { backgroundColor: v3.colors.pill },
  tileDark: { backgroundColor: v3.colors.stageTile },
  tileDarkLit: { backgroundColor: v3.colors.onSignal },
  tileLabel: { ...v3.type.label, textAlign: 'center' },

  pair: { flexDirection: 'row', gap: v3.space[12] },
  half: { flex: 1 },
  pill: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[10],
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: v3.space[16],
  },
  pillBig: { minHeight: 64 },
  pillHangUp: { backgroundColor: v3.colors.hangUp },
  pillAnswer: { backgroundColor: v3.colors.yellow },
  pillOutline: { borderColor: v3.colors.fg, borderWidth: 2 },
  pillQuiet: { backgroundColor: v3.colors.surface },
  pillOk: { backgroundColor: v3.colors.blue, minHeight: 60 },
  pillLabel: { ...v3.type.button, flexShrink: 1 },
  pillLabelBig: { ...v3.type.headline, flexShrink: 1 },

  askHead: { alignItems: 'center', flexDirection: 'row', gap: v3.space[10] },
  askBadge: {
    ...v3.type.label,
    backgroundColor: v3.colors.fg,
    borderRadius: v3.radius.pill,
    color: v3.colors.bg,
    overflow: 'hidden',
    paddingHorizontal: v3.space[10],
    paddingVertical: v3.space[6],
    textTransform: 'uppercase',
  },
  askTitle: { ...v3.type.headline, color: v3.colors.fg, flexShrink: 1 },
  askBody: { ...v3.type.body, color: v3.colors.muted },
}))
