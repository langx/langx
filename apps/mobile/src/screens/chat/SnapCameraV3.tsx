import Feather from '@expo/vector-icons/Feather'
import { MAX_VIDEO_SECONDS } from '@langx/shared'
import { useEffect, useMemo, type ReactNode } from 'react'
import { Text, View } from 'react-native'
import { Gesture, GestureDetector, type PanGesture } from 'react-native-gesture-handler'
import Animated, {
  cancelAnimation,
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { Button } from '../../components/ui/Button'
import { ICON_BUTTON_TARGET, IconButton } from '../../components/ui/IconButton'
import { PressableScale } from '../../components/ui/PressableScale'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useT } from '../../i18n'
import { makeStyles, useTheme } from '../../lib/theme'
import { SPRING, TIMING, unlessReduced } from '../../lib/theme/motion'
import { DURATION } from '../../lib/theme/motionValues'

/*
 * Literal colours, as in `chat-camera.tsx` and `SnapPreviewV3`: the camera is
 * black in both schemes, so nothing here follows the app's. The scrim is
 * `V-ViewOnce`'s, the off glyph tile `V-ChatCamera`'s unpicked option.
 */
const ON_STAGE = '#ffffff'
const ON_STAGE_MUTED = 'rgba(255, 255, 255, 0.82)'
const SCRIM = 'rgba(12, 13, 16, 0.62)'
const TILE = 'rgba(255, 255, 255, 0.14)'
const INK = '#14161b'
const RECORDING = '#ff3b30'
/** The ring under the progress arc while recording: there, but quieter than the arc. */
const RING_RECORDING = 'rgba(255, 255, 255, 0.35)'

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

/*
 * The camera's states before the shutter, in the redesign's look, behind
 * `flags.v3Home`: the viewfinder, the permission screen and the web's
 * library-only screen. `V-ChatCamera` draws the step after the shutter
 * (`SnapPreviewV3`); these are drawn in its language — the kit's dark discs
 * for the corner controls, `V-ViewOnce`'s scrim pill for words over the
 * picture, the 56pt pills and the one yellow on the step's committing action.
 *
 * Only drawings. The camera itself, the hold-to-record timing, both
 * permission prompts, the remembered mode and the send stay
 * `chat-camera.tsx`'s, which hands every handler in.
 */

/** Close at the top start, and whatever the state puts at the top end. */
export function StageTopBar({
  onClose,
  closeLabel,
  children,
}: {
  onClose: (() => void) | undefined
  /** What the ✕ does, when that is not closing the camera. */
  closeLabel?: string
  children?: ReactNode
}) {
  const t = useT()
  const styles = useStyles()
  return (
    <View style={styles.topBar} pointerEvents="box-none">
      {onClose ? (
        <IconButton
          icon="x"
          iconSize={22}
          look="hue"
          accessibilityLabel={closeLabel ?? t('viewOnce.close')}
          onPress={onClose}
          hitSlop={10}
        />
      ) : (
        <View />
      )}
      {children}
    </View>
  )
}

/** The live viewfinder's chrome, laid over the camera the route draws. */
export function SnapViewfinderV3({
  camera,
  recording,
  elapsed,
  flashOn,
  bottomInset,
  onClose,
  onFlash,
  onLibrary,
  onFlip,
  onPressIn,
  onPressOut,
  shutterGesture,
  filterStrip,
}: {
  /** The route's `CameraView`, filling the frame. */
  camera: ReactNode
  recording: boolean
  /** Whole seconds since recording began. */
  elapsed: number
  flashOn: boolean
  bottomInset: number
  onClose: () => void
  onFlash: () => void
  onLibrary: () => void
  onFlip: () => void
  /** Tap for a photo, hold for a video; for a screen reader, whose tap is an action. */
  onPressIn: () => void
  onPressOut: () => void
  /** The finger on the shutter: the press, and the slide up that zooms (`useCameraZoom`). */
  shutterGesture: PanGesture
  /**
   * The filters' names, above the shutter. Faded out while recording: a
   * filter is baked into photos only, so a clip would not keep it.
   */
  filterStrip?: ReactNode
}) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()

  return (
    <>
      {camera}

      {/* Close goes while recording: letting go of the shutter is the way out. */}
      <StageTopBar onClose={recording ? undefined : onClose}>
        {recording ? (
          <View style={styles.timer} accessibilityLabel={t('viewOnce.recording')}>
            <View style={styles.timerDot} />
            <Text style={styles.timerText}>
              {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
            </Text>
          </View>
        ) : (
          // The kit's disc, drawn here because a toggle needs `selected`,
          // which `IconButton` does not carry. On, it turns white, as a
          // picked option does on the next step.
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('viewOnce.flash')}
            accessibilityState={{ selected: flashOn }}
            onPress={onFlash}
            hitSlop={10}
            scaleTo={0.88}
            style={[styles.disc, flashOn && styles.discOn]}
          >
            <Feather
              name={flashOn ? 'zap' : 'zap-off'}
              size={v3.icon.md}
              color={flashOn ? INK : ON_STAGE}
            />
          </PressableScale>
        )}
      </StageTopBar>

      {/*
        `box-none` all the way down: the foot spans the frame's width, and
        without it a pinch that starts beside the shutter would land on the
        foot instead of the picture.
      */}
      <View
        style={[styles.foot, { paddingBottom: v3.space[24] + bottomInset }]}
        pointerEvents="box-none"
      >
        {recording ? null : (
          <View style={styles.hint}>
            <Text style={styles.hintText}>{t('viewOnce.hint')}</Text>
          </View>
        )}
        {filterStrip ? (
          <FadesWhileRecording recording={recording} stretch>
            {filterStrip}
          </FadesWhileRecording>
        ) : null}
        <View style={styles.shutterRow} pointerEvents="box-none">
          <FadesWhileRecording recording={recording}>
            <IconButton
              icon="image"
              iconSize={v3.icon.lg}
              look="hue"
              accessibilityLabel={t('viewOnce.gallery')}
              onPress={onLibrary}
              disabled={recording}
              hitSlop={10}
            />
          </FadesWhileRecording>
          <Shutter
            recording={recording}
            elapsed={elapsed}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            gesture={shutterGesture}
          />
          <FadesWhileRecording recording={recording}>
            <IconButton
              icon="refresh-cw"
              iconSize={v3.icon.md}
              look="hue"
              accessibilityLabel={t('viewOnce.flip')}
              onPress={onFlip}
              disabled={recording}
              hitSlop={10}
            />
          </FadesWhileRecording>
        </View>
      </View>
    </>
  )
}

/** Gallery and flip, faded out while recording; they keep their place, so nothing shifts. */
function FadesWhileRecording({
  recording,
  stretch = false,
  children,
}: {
  recording: boolean
  /** As wide as the foot, for the filter strip; the buttons keep their own width. */
  stretch?: boolean
  children: ReactNode
}) {
  const styles = useStyles()
  const reduce = useReduceMotion()
  const shown = useSharedValue(recording ? 0 : 1)
  useEffect(() => {
    shown.set(unlessReduced(reduce, recording ? 0 : 1, (to) => withTiming(to, TIMING.fade)))
  }, [recording, reduce, shown])
  const fade = useAnimatedStyle(() => ({ opacity: shown.get() }))
  return (
    <Animated.View
      style={[fade, stretch && styles.stretch]}
      pointerEvents={recording ? 'none' : 'auto'}
      accessibilityElementsHidden={recording}
      importantForAccessibility={recording ? 'no-hide-descendants' : 'auto'}
    >
      {children}
    </Animated.View>
  )
}

/**
 * The story camera's shutter. Tap for a photo, hold for a video; holding, the
 * ring grows and the white core becomes a small red square, and a red arc
 * fills the ring over the clip's minute so the time left is never a guess.
 *
 * Drawn at its recording size and scaled down at rest, so the morph animates
 * transforms and colours on the UI thread rather than laying out the foot
 * again every frame.
 *
 * Not a `PressableScale`: the finger that holds it may slide up the screen to
 * zoom, and a `Pressable` ends its press once the finger leaves it, which
 * would stop the clip. `gesture` owns the touch instead, and the face shrinks
 * as `PressableScale`'s does, from a second pan that only watches.
 */
function Shutter({
  recording,
  elapsed,
  onPressIn,
  onPressOut,
  gesture,
}: {
  recording: boolean
  /** Whole seconds since recording began. */
  elapsed: number
  onPressIn: () => void
  onPressOut: () => void
  gesture: PanGesture
}) {
  const t = useT()
  const styles = useStyles()
  const reduce = useReduceMotion()
  // 1 while the finger is down: the face shrinks, or with reduce motion dims.
  const pressed = useSharedValue(0)
  const touch = useMemo(() => {
    const feedback = Gesture.Pan()
      .minDistance(0)
      .onBegin(() => {
        pressed.set(withTiming(1, { duration: DURATION.press }))
      })
      .onFinalize(() => {
        pressed.set(withTiming(0, { duration: DURATION.release }))
      })
    return Gesture.Simultaneous(gesture, feedback)
  }, [gesture, pressed])
  // Both properties always, so the face never gains a transform mid-press:
  // see `PressableScale` on what that does to Android's Fabric.
  const face = useAnimatedStyle(() => ({
    opacity: reduce ? interpolate(pressed.get(), [0, 1], [1, PRESSED_DIM]) : 1,
    transform: [{ scale: reduce ? 1 : interpolate(pressed.get(), [0, 1], [1, SHUTTER_PRESSED]) }],
  }))
  // 0 at rest, 1 recording: the ring's size and colour and the core's shape follow it.
  const morph = useSharedValue(0)
  // How much of the minute is used, 0…1.
  const sweep = useSharedValue(0)

  useEffect(() => {
    morph.set(unlessReduced(reduce, recording ? 1 : 0, (to) => withSpring(to, SPRING.select)))
  }, [recording, reduce, morph])

  useEffect(() => {
    cancelAnimation(sweep)
    sweep.set(0)
    // Reduced motion steps the arc from the clock below instead of sweeping it.
    if (!recording || reduce) return
    sweep.set(withTiming(1, { duration: MAX_VIDEO_SECONDS * 1000, easing: Easing.linear }))
  }, [recording, reduce, sweep])

  useEffect(() => {
    if (recording && reduce) sweep.set(Math.min(1, elapsed / MAX_VIDEO_SECONDS))
  }, [recording, reduce, elapsed, sweep])

  const ring = useAnimatedStyle(() => {
    const progress = morph.get()
    return {
      borderColor: interpolateColor(progress, [0, 1], [ON_STAGE, RING_RECORDING]),
      transform: [{ scale: interpolate(progress, [0, 1], [SHUTTER / SHUTTER_RECORDING, 1]) }],
    }
  })
  const core = useAnimatedStyle(() => {
    const progress = morph.get()
    return {
      backgroundColor: interpolateColor(progress, [0, 1], [ON_STAGE, RECORDING]),
      // 8pt corners once scaled down to the 30pt square.
      borderRadius: interpolate(progress, [0, 1], [CORE / 2, (8 * CORE) / CORE_RECORDING]),
      transform: [{ scale: interpolate(progress, [0, 1], [1, CORE_RECORDING / CORE]) }],
    }
  })
  const arc = useAnimatedProps(() => ({
    strokeDashoffset: ARC_LENGTH * (1 - Math.min(1, Math.max(0, sweep.get()))),
  }))

  return (
    <GestureDetector gesture={touch}>
      <Animated.View
        collapsable={false}
        accessible
        accessibilityRole="button"
        accessibilityLabel={t('viewOnce.shutter')}
        accessibilityHint={t('viewOnce.hint')}
        // A screen reader's double-tap is an action, not a touch: a press and
        // a release at once, which the route's timing reads as a photo. A
        // double-tap and hold still reaches `gesture` as a real touch.
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={() => {
          onPressIn()
          onPressOut()
        }}
        style={[styles.shutterTouch, styles.shutter, face]}
      >
        <Animated.View style={[styles.shutterRing, ring]}>
          <Animated.View style={[styles.shutterCore, core]} />
          {recording ? (
            <Svg
              width={SHUTTER_RECORDING}
              height={SHUTTER_RECORDING}
              style={styles.shutterArc}
              pointerEvents="none"
            >
              <AnimatedCircle
                cx={SHUTTER_RECORDING / 2}
                cy={SHUTTER_RECORDING / 2}
                r={ARC_RADIUS}
                stroke={RECORDING}
                strokeWidth={RING_WIDTH}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={ARC_LENGTH}
                animatedProps={arc}
              />
            </Svg>
          ) : null}
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  )
}

/**
 * A glyph, a heading and a line in the middle of the stage, and the step's
 * buttons at its foot: the permission screen and the web's library screen.
 */
function StageNote({
  icon,
  title,
  body,
  bottomInset,
  onClose,
  children,
}: {
  icon: keyof typeof Feather.glyphMap
  title?: string
  body: string
  bottomInset: number
  onClose: () => void
  children: ReactNode
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View style={styles.note}>
      <StageTopBar onClose={onClose} />
      <View style={styles.noteMiddle}>
        <View style={styles.noteGlyph}>
          <Feather name={icon} size={40} color={ON_STAGE} />
        </View>
        {title ? (
          <Text accessibilityRole="header" style={styles.noteTitle}>
            {title}
          </Text>
        ) : null}
        <Text style={styles.noteBody}>{body}</Text>
      </View>
      <View style={[styles.noteActions, { paddingBottom: v3.space[16] + bottomInset }]}>
        {children}
      </View>
    </View>
  )
}

/** No camera permission: allow it (or go to Settings), or take one from the library. */
export function CameraPermissionV3({
  canAskAgain,
  bottomInset,
  onAllow,
  onLibrary,
  onClose,
}: {
  /** False once the phone has stopped asking; the button then opens Settings. */
  canAskAgain: boolean
  bottomInset: number
  onAllow: () => void
  onLibrary: () => void
  onClose: () => void
}) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <StageNote
      icon="camera"
      title={t('scan.permissionTitle')}
      body={t('viewOnce.cameraPermission')}
      bottomInset={bottomInset}
      onClose={onClose}
    >
      <Button label={canAskAgain ? t('scan.allow') : t('scan.openSettings')} onPress={onAllow} />
      {/*
        The outline in the stage's white, by hand, as `SnapPreviewV3`'s Retake
        is: the kit's outline takes the scheme's text colour, which is dark on
        a light phone and would vanish on the black stage.
      */}
      <PressableScale accessibilityRole="button" onPress={onLibrary} style={styles.outline}>
        <Feather name="image" size={v3.icon.lg} color={ON_STAGE} />
        <Text style={styles.outlineLabel}>{t('viewOnce.gallery')}</Text>
      </PressableScale>
    </StageNote>
  )
}

/** The web: no capture here, as there is none in the attach sheet — the library instead. */
export function LibraryOnlyV3({
  bottomInset,
  onLibrary,
  onClose,
}: {
  bottomInset: number
  onLibrary: () => void
  onClose: () => void
}) {
  const t = useT()
  return (
    <StageNote
      icon="image"
      body={t('viewOnce.cameraUnavailable')}
      bottomInset={bottomInset}
      onClose={onClose}
    >
      <Button label={t('viewOnce.gallery')} icon="image" onPress={onLibrary} />
    </StageNote>
  )
}

const SHUTTER = 80
const SHUTTER_RECORDING = 92
/** The ring is drawn at the recording size, so this is 5pt once scaled down to rest. */
const RING_WIDTH = (5 * SHUTTER_RECORDING) / SHUTTER
const ARC_RADIUS = (SHUTTER_RECORDING - RING_WIDTH) / 2
const ARC_LENGTH = 2 * Math.PI * ARC_RADIUS
const CORE = 62
const CORE_RECORDING = 30
/** `PressableScale`'s face under the finger: the old `scaleTo`, and its reduce-motion dim. */
const SHUTTER_PRESSED = 0.92
const PRESSED_DIM = 0.7

const useStyles = makeStyles(({ v3 }) => ({
  topBar: {
    alignItems: 'center',
    end: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: v3.space[16],
    position: 'absolute',
    start: 0,
    top: 0,
  },
  disc: {
    alignItems: 'center',
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    height: ICON_BUTTON_TARGET,
    justifyContent: 'center',
    width: ICON_BUTTON_TARGET,
  },
  discOn: { backgroundColor: ON_STAGE },
  timer: {
    alignItems: 'center',
    backgroundColor: SCRIM,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[8],
    minHeight: ICON_BUTTON_TARGET,
    paddingHorizontal: v3.space[14],
  },
  timerDot: { backgroundColor: RECORDING, borderRadius: 5, height: 10, width: 10 },
  timerText: { ...v3.type.buttonSmall, color: ON_STAGE, fontVariant: ['tabular-nums'] },
  foot: {
    alignItems: 'center',
    bottom: 0,
    end: 0,
    gap: v3.space[16],
    paddingHorizontal: v3.space[16],
    position: 'absolute',
    start: 0,
  },
  hint: {
    backgroundColor: SCRIM,
    borderRadius: v3.radius.pill,
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[6],
  },
  hintText: { ...v3.type.caption, color: ON_STAGE, textAlign: 'center' },
  stretch: { alignSelf: 'stretch' },
  shutterRow: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  // The grown ring overhangs the row by 6pt above and below rather than making it taller.
  shutterTouch: { marginVertical: (SHUTTER - SHUTTER_RECORDING) / 2 },
  shutter: { height: SHUTTER_RECORDING, width: SHUTTER_RECORDING },
  shutterRing: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    borderWidth: RING_WIDTH,
    height: SHUTTER_RECORDING,
    justifyContent: 'center',
    width: SHUTTER_RECORDING,
  },
  shutterCore: { height: CORE, width: CORE },
  // Over the ring (its box starts inside the border), starting at twelve o'clock.
  shutterArc: {
    left: -RING_WIDTH,
    position: 'absolute',
    top: -RING_WIDTH,
    transform: [{ rotate: '-90deg' }],
  },
  note: { flex: 1 },
  noteMiddle: {
    alignItems: 'center',
    flex: 1,
    gap: v3.space[16],
    justifyContent: 'center',
    paddingHorizontal: v3.space[24],
  },
  noteGlyph: {
    alignItems: 'center',
    backgroundColor: TILE,
    borderRadius: v3.radius.block,
    height: 88,
    justifyContent: 'center',
    marginBottom: v3.space[4],
    width: 88,
  },
  noteTitle: { ...v3.type.headline, color: ON_STAGE, textAlign: 'center' },
  noteBody: { ...v3.type.body, color: ON_STAGE_MUTED, maxWidth: 320, textAlign: 'center' },
  noteActions: { gap: v3.space[8], paddingHorizontal: v3.space[16] },
  outline: {
    alignItems: 'center',
    borderColor: ON_STAGE,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    flexDirection: 'row',
    gap: v3.space[8],
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: v3.space[20],
  },
  outlineLabel: { ...v3.type.button, color: ON_STAGE },
}))
