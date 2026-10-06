import Feather from '@expo/vector-icons/Feather'
import { MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS } from '@langx/shared'
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
  type CameraType,
} from 'expo-camera'
import { Image } from 'expo-image'
import { useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  AppState,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'
import { useT } from '../../src/i18n'
import { showAlert } from '../../src/lib/alert'
import { impact } from '../../src/lib/haptics'
import { goBackTo } from '../../src/lib/navigation'
import { pickMediaAssets } from '../../src/lib/pickMediaAsset'
import type { PickedMedia } from '../../src/lib/pickedAssets'
import { sendSnap } from '../../src/lib/snapOutbox'
import { makeStyles, spacing } from '../../src/lib/theme'
import { showToast } from '../../src/lib/toast'
import {
  pickSixteenNineSize,
  SNAP_MODES,
  viewOnceForMode,
  type SnapMode,
} from '../../src/lib/viewOnce'

/*
 * Literal colours, as in `scan.tsx`: a camera is dark whichever scheme the app
 * is in, and the palette's `bg` and `text` flip with the scheme.
 */
const STAGE_BG = '#000000'
const ON_STAGE = '#ffffff'
const ON_STAGE_MUTED = 'rgba(255, 255, 255, 0.75)'
const SCRIM = 'rgba(0, 0, 0, 0.35)'
const RECORDING = '#ff3b30'

/** How long a press has to last before it is a video rather than a photo. */
const HOLD_MS = 260
/**
 * How long the camera is given to switch to video before recording starts.
 * Android rebinds the whole camera for the switch, iOS only adds an output to
 * a running session; `onCameraReady` starts it sooner where it fires again.
 */
const MODE_SETTLE_MS = Platform.OS === 'android' ? 700 : 250
/**
 * Five megabits. A phone's default for 1080p is about three times that, which
 * puts a full minute at well over `MAX_VIDEO_BYTES`; at this rate the minute
 * is under forty megabytes and still sharp on the screen it is watched on.
 */
const VIDEO_BITRATE = 5_000_000

/**
 * The frame the camera and the preview are drawn in: 9:16, as wide as the
 * screen allows. A phone taller than 16:9 gets the whole width and a band
 * below for the hint; a squat window gets the whole height and bands at the
 * sides. Either way the picture is the shape it will be seen in.
 */
function frameFor(width: number, height: number): { width: number; height: number } {
  const byWidth = { width, height: (width * 16) / 9 }
  if (byWidth.height <= height) return byWidth
  return { width: (height * 9) / 16, height }
}

/**
 * The chat camera: always full screen and 16:9, like Instagram's. Tap the
 * shutter for a photo, hold it for a video. What was shot is then sent as
 * view once, allow replay, or an ordinary message — the three buttons on the
 * preview.
 *
 * It sends nothing itself. It hands the file to the thread underneath
 * (`snapOutbox`), which already knows how to upload, retry and refuse, and
 * goes back. On the web there is no capture here, as there is none in the
 * attach sheet: the screen opens on the library instead.
 */
export default function SnapScreen() {
  useScreenInteractive()
  const t = useT()
  const styles = useStyles()
  const insets = useSafeAreaInsets()
  const window = useWindowDimensions()
  const { id } = useLocalSearchParams<{ id: string }>()
  const conversationId = id ?? ''
  const [captured, setCaptured] = useState<PickedMedia | null>(null)
  const [mode, setMode] = useState<SnapMode>('once')

  const frame = frameFor(window.width, window.height - insets.top - insets.bottom)
  // Rounded only when there is stage around it; edge to edge it would cut the corners off.
  const rounded = frame.height < window.height - insets.top - insets.bottom - 1

  function close(): void {
    goBackTo(`/(app)/chat/${conversationId}`)
  }

  async function pickFromLibrary(): Promise<void> {
    const picked = await pickMediaAssets({ remaining: 1, source: 'library' })
    if (picked.status === 'denied') {
      void showAlert(t('chat.photosTitle'), t('chat.photosPermission'))
      return
    }
    if (picked.status === 'cancelled') return
    const first = picked.media[0]
    if (first) {
      setCaptured(first)
      return
    }
    if (picked.refused) {
      void showAlert(
        t('chat.couldNotSend'),
        picked.refused.reason === 'tooLong'
          ? t('errors.videoTooLong', { count: MAX_VIDEO_SECONDS })
          : picked.refused.reason === 'tooLarge'
            ? t('errors.attachmentTooLarge')
            : t('errors.attachmentUnsupported'),
      )
    }
  }

  function send(): void {
    if (!captured || !conversationId) return
    sendSnap({ conversationId, item: captured, viewOnce: viewOnceForMode(mode) })
    void impact('light')
    close()
  }

  return (
    <View style={styles.stage}>
      <StatusBar style="light" />
      <View
        style={[
          styles.frame,
          rounded && styles.frameRounded,
          {
            top: insets.top,
            left: (window.width - frame.width) / 2,
            width: frame.width,
            height: frame.height,
          },
        ]}
      >
        {captured ? (
          <SnapPreview
            item={captured}
            mode={mode}
            bottomInset={rounded ? 0 : insets.bottom}
            onMode={setMode}
            onRetake={() => setCaptured(null)}
            onSend={send}
          />
        ) : Platform.OS === 'web' ? (
          <LibraryOnly onLibrary={() => void pickFromLibrary()} onClose={close} />
        ) : (
          <SnapCamera
            bottomInset={rounded ? 0 : insets.bottom}
            onCaptured={setCaptured}
            onLibrary={() => void pickFromLibrary()}
            onClose={close}
          />
        )}
      </View>
    </View>
  )
}

function SnapCamera({
  bottomInset,
  onCaptured,
  onLibrary,
  onClose,
}: {
  bottomInset: number
  onCaptured: (item: PickedMedia) => void
  onLibrary: () => void
  onClose: () => void
}) {
  const t = useT()
  const styles = useStyles()
  const [permission, requestPermission, getPermission] = useCameraPermissions()
  const [microphone, requestMicrophone] = useMicrophonePermissions()
  const camera = useRef<CameraView>(null)
  const [facing, setFacing] = useState<CameraType>('back')
  const [flash, setFlash] = useState<'off' | 'on'>('off')
  const [cameraMode, setCameraMode] = useState<'picture' | 'video'>('picture')
  const [muted, setMuted] = useState(false)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  /** Per lens: the front and back cameras offer different sizes. */
  const [pictureSizes, setPictureSizes] = useState<Partial<Record<CameraType, string | null>>>({})

  const holding = useRef(false)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** The press became a video; recording starts once the camera is in video mode. */
  const wantsRecording = useRef(false)
  const recordingNow = useRef(false)
  const shooting = useRef(false)
  const startedAt = useRef(0)

  // The clock on screen while recording, in whole seconds.
  useEffect(() => {
    if (!recording) return
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)),
      250,
    )
    return () => clearInterval(timer)
  }, [recording])

  // Recording waits for the switch to video. See `MODE_SETTLE_MS`.
  useEffect(() => {
    if (cameraMode !== 'video' || !wantsRecording.current) return
    const timer = setTimeout(() => void record(), MODE_SETTLE_MS)
    return () => clearTimeout(timer)
    // `record` is re-made each render and reads only refs; the mode is the trigger.
  }, [cameraMode])

  /*
   * Read again whenever the app comes back to the front. Two ways the answer
   * changes behind the hook's back: the system's own permission sheet, after
   * which Android was seen keeping the old "denied" until the next tap, and a
   * trip to Settings from the button below.
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void getPermission()
    })
    return () => subscription.remove()
  }, [getPermission])

  // A timer left running when the screen goes would fire into an unmounted camera.
  useEffect(
    () => () => {
      if (holdTimer.current) clearTimeout(holdTimer.current)
    },
    [],
  )

  function onCameraReady(): void {
    if (cameraMode === 'video' && wantsRecording.current) {
      void record()
      return
    }
    if (pictureSizes[facing] !== undefined) return
    void camera.current
      ?.getAvailablePictureSizesAsync()
      .then((sizes) =>
        setPictureSizes((known) => ({ ...known, [facing]: pickSixteenNineSize(sizes) ?? null })),
      )
      .catch(() => setPictureSizes((known) => ({ ...known, [facing]: null })))
  }

  async function takePhoto(): Promise<void> {
    if (shooting.current || !camera.current) return
    shooting.current = true
    try {
      const picture = await camera.current.takePictureAsync({ quality: 0.8 })
      if (picture?.uri) {
        onCaptured({
          kind: 'image',
          uri: picture.uri,
          contentType: 'image/jpeg',
          width: picture.width,
          height: picture.height,
        })
      }
    } catch {
      showToast(t('viewOnce.captureFailed'))
    } finally {
      shooting.current = false
    }
  }

  async function beginRecording(): Promise<void> {
    holdTimer.current = null
    void impact('medium')
    // Asked on the first hold, not when the camera opens: a photo needs no
    // microphone, and asking for one up front would be asking for nothing.
    // Refused, the video is still recorded — without its sound.
    let withoutSound = false
    if (!microphone?.granted) {
      const answer = await requestMicrophone()
      withoutSound = !answer.granted
    }
    // A permission prompt takes the finger off the shutter. Hold again.
    if (!holding.current) return
    setMuted(withoutSound)
    wantsRecording.current = true
    setCameraMode('video')
  }

  async function record(): Promise<void> {
    if (!wantsRecording.current || recordingNow.current) return
    wantsRecording.current = false
    const view = camera.current
    if (!holding.current || !view) {
      setCameraMode('picture')
      return
    }
    recordingNow.current = true
    startedAt.current = Date.now()
    setElapsed(0)
    setRecording(true)
    try {
      const video = await view.recordAsync({
        maxDuration: MAX_VIDEO_SECONDS,
        maxFileSize: MAX_VIDEO_BYTES,
        // iOS honours `videoBitrate` only with a codec named.
        ...(Platform.OS === 'ios' ? { codec: 'avc1' as const } : {}),
      })
      // From the clock rather than the file, which nothing here can read: the
      // server needs a length, and a second either way is inside the ceiling.
      const seconds = Math.min(
        MAX_VIDEO_SECONDS,
        Math.max(1, Math.ceil((Date.now() - startedAt.current) / 1000)),
      )
      if (video?.uri) {
        onCaptured({
          kind: 'video',
          uri: video.uri,
          contentType: video.uri.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4',
          durationSeconds: seconds,
        })
      }
    } catch {
      showToast(t('viewOnce.captureFailed'))
    } finally {
      recordingNow.current = false
      setRecording(false)
      setCameraMode('picture')
    }
  }

  function onPressIn(): void {
    holding.current = true
    holdTimer.current = setTimeout(() => void beginRecording(), HOLD_MS)
  }

  function onPressOut(): void {
    holding.current = false
    if (holdTimer.current) {
      // Let go before it became a hold: a photo.
      clearTimeout(holdTimer.current)
      holdTimer.current = null
      void takePhoto()
      return
    }
    if (recordingNow.current) camera.current?.stopRecording()
  }

  if (!permission) {
    return (
      <View style={styles.centre}>
        <ActivityIndicator color={ON_STAGE} />
      </View>
    )
  }

  if (!permission.granted) {
    return (
      <View style={styles.centre}>
        <TopBar onClose={onClose} />
        <Feather name="camera" size={40} color={ON_STAGE} />
        <Text style={styles.permissionTitle}>{t('scan.permissionTitle')}</Text>
        <Text style={styles.permissionBody}>{t('viewOnce.cameraPermission')}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            if (permission.canAskAgain === false) void Linking.openSettings()
            else void requestPermission().then(() => getPermission())
          }}
          style={({ pressed }) => [styles.pillButton, pressed && styles.pressed]}
        >
          <Text style={styles.pillButtonLabel}>
            {permission.canAskAgain === false ? t('scan.openSettings') : t('scan.allow')}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onLibrary}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={styles.link}>{t('viewOnce.gallery')}</Text>
        </Pressable>
      </View>
    )
  }

  const pictureSize = pictureSizes[facing]

  return (
    <>
      <CameraView
        ref={camera}
        style={StyleSheet.absoluteFill}
        facing={facing}
        mode={cameraMode}
        flash={flash}
        enableTorch={recording && flash === 'on'}
        mirror={facing === 'front'}
        mute={muted}
        videoQuality="1080p"
        videoBitrate={VIDEO_BITRATE}
        // Android fits a 16:9 preview into the 9:16 frame; iOS fills the frame
        // and takes the 16:9 still from `pictureSize`.
        {...(Platform.OS === 'android' ? { ratio: '16:9' as const } : {})}
        {...(pictureSize ? { pictureSize } : {})}
        onCameraReady={onCameraReady}
        onMountError={() => showToast(t('viewOnce.captureFailed'))}
      />

      <TopBar onClose={recording ? undefined : onClose}>
        {recording ? (
          <View style={styles.timer} accessibilityLabel={t('viewOnce.recording')}>
            <View style={styles.timerDot} />
            <Text style={styles.timerText}>
              {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
            </Text>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('viewOnce.flash')}
            accessibilityState={{ selected: flash === 'on' }}
            onPress={() => setFlash((on) => (on === 'on' ? 'off' : 'on'))}
            hitSlop={10}
            style={({ pressed }) => [styles.roundIcon, pressed && styles.pressed]}
          >
            <Feather name={flash === 'on' ? 'zap' : 'zap-off'} size={20} color={ON_STAGE} />
          </Pressable>
        )}
      </TopBar>

      <View style={[styles.bottom, { paddingBottom: spacing.xl + bottomInset }]}>
        {recording ? null : <Text style={styles.hint}>{t('viewOnce.hint')}</Text>}
        <View style={styles.shutterRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('viewOnce.gallery')}
            onPress={onLibrary}
            disabled={recording}
            hitSlop={10}
            style={({ pressed }) => [
              styles.roundIcon,
              recording && styles.hidden,
              pressed && styles.pressed,
            ]}
          >
            <Feather name="image" size={22} color={ON_STAGE} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('viewOnce.shutter')}
            accessibilityHint={t('viewOnce.hint')}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            style={[styles.shutter, recording && styles.shutterRecording]}
          >
            <View style={[styles.shutterCore, recording && styles.shutterCoreRecording]} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('viewOnce.flip')}
            onPress={() => setFacing((side) => (side === 'back' ? 'front' : 'back'))}
            disabled={recording}
            hitSlop={10}
            style={({ pressed }) => [
              styles.roundIcon,
              recording && styles.hidden,
              pressed && styles.pressed,
            ]}
          >
            <Feather name="refresh-cw" size={20} color={ON_STAGE} />
          </Pressable>
        </View>
      </View>
    </>
  )
}

function SnapPreview({
  item,
  mode,
  bottomInset,
  onMode,
  onRetake,
  onSend,
}: {
  item: PickedMedia
  mode: SnapMode
  bottomInset: number
  onMode: (mode: SnapMode) => void
  onRetake: () => void
  onSend: () => void
}) {
  const t = useT()
  const styles = useStyles()
  const labels: Record<SnapMode, string> = {
    once: t('viewOnce.modeOnce'),
    replay: t('viewOnce.modeReplay'),
    keep: t('viewOnce.modeKeep'),
  }

  return (
    <>
      {item.kind === 'video' ? (
        <PreviewVideo uri={item.uri} />
      ) : (
        <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
      )}
      <TopBar onClose={onRetake} closeLabel={t('viewOnce.retake')} />
      <View style={[styles.bottom, { paddingBottom: spacing.xl + bottomInset }]}>
        {/* All three at once, tapped to pick, rather than one pill tapped to
            cycle: cycling hid the choice behind taps nobody knew to count.
            Equal thirds of the width, and a long label (German, French,
            Turkish) shrinks a little and then takes a second line, so a 360pt
            phone never pushes a button off the edge. */}
        <View style={styles.modes}>
          {SNAP_MODES.map((option) => {
            const selected = option === mode
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onMode(option)}
                style={({ pressed }) => [
                  styles.modeOption,
                  selected && styles.modeOptionOn,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[styles.modeLabel, selected && styles.modeLabelOn]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  {labels[option]}
                </Text>
              </Pressable>
            )
          })}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onSend}
          style={({ pressed }) => [styles.send, pressed && styles.pressed]}
        >
          <Text style={styles.sendLabel}>{t('viewOnce.send')}</Text>
          <Feather name="arrow-right" size={18} color={styles.sendLabel.color} />
        </Pressable>
      </View>
    </>
  )
}

function PreviewVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true
    instance.play()
  })
  return (
    <VideoView
      player={player}
      // Sized, not `absoluteFill`: see the viewer's note on the web player.
      style={{ height: '100%', width: '100%' }}
      contentFit="contain"
      nativeControls={false}
    />
  )
}

function LibraryOnly({ onLibrary, onClose }: { onLibrary: () => void; onClose: () => void }) {
  const t = useT()
  const styles = useStyles()
  return (
    <View style={styles.centre}>
      <TopBar onClose={onClose} />
      <Feather name="image" size={40} color={ON_STAGE} />
      <Text style={styles.permissionBody}>{t('viewOnce.cameraUnavailable')}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onLibrary}
        style={({ pressed }) => [styles.pillButton, pressed && styles.pressed]}
      >
        <Text style={styles.pillButtonLabel}>{t('viewOnce.gallery')}</Text>
      </Pressable>
    </View>
  )
}

/** The close button top left, and whatever the screen puts top right. */
function TopBar({
  onClose,
  closeLabel,
  children,
}: {
  onClose: (() => void) | undefined
  closeLabel?: string
  children?: React.ReactNode
}) {
  const t = useT()
  const styles = useStyles()
  return (
    <View style={styles.topBar} pointerEvents="box-none">
      {onClose ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel ?? t('viewOnce.close')}
          onPress={onClose}
          hitSlop={10}
          style={({ pressed }) => [styles.roundIcon, pressed && styles.pressed]}
        >
          <Feather name="x" size={22} color={ON_STAGE} />
        </Pressable>
      ) : (
        <View />
      )}
      {children}
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, radius }) => ({
  stage: { backgroundColor: STAGE_BG, flex: 1 },
  frame: { backgroundColor: STAGE_BG, overflow: 'hidden', position: 'absolute' },
  frameRounded: { borderRadius: radius.lg },
  centre: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.lg,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    padding: spacing.lg,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  roundIcon: {
    alignItems: 'center',
    backgroundColor: SCRIM,
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  hidden: { opacity: 0 },
  pressed: { opacity: 0.6 },
  timer: {
    alignItems: 'center',
    backgroundColor: SCRIM,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  timerDot: { backgroundColor: RECORDING, borderRadius: 5, height: 10, width: 10 },
  timerText: {
    color: ON_STAGE,
    fontSize: 15,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
  },
  bottom: {
    alignItems: 'center',
    bottom: 0,
    gap: spacing.lg,
    left: 0,
    paddingHorizontal: spacing.lg,
    position: 'absolute',
    right: 0,
  },
  hint: { color: ON_STAGE_MUTED, fontSize: 13, textAlign: 'center' },
  shutterRow: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  shutter: {
    alignItems: 'center',
    borderColor: ON_STAGE,
    borderRadius: 40,
    borderWidth: 5,
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
  shutterRecording: { borderColor: RECORDING, height: 92, width: 92, borderRadius: 46 },
  shutterCore: { backgroundColor: ON_STAGE, borderRadius: 31, height: 62, width: 62 },
  shutterCoreRecording: {
    backgroundColor: RECORDING,
    borderRadius: radius.sm,
    height: 30,
    width: 30,
  },
  permissionTitle: { ...font.heading, color: ON_STAGE, textAlign: 'center' },
  permissionBody: {
    color: ON_STAGE_MUTED,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 300,
    textAlign: 'center',
  },
  pillButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.xl,
  },
  pillButtonLabel: { ...font.heading, color: colors.primaryText, fontSize: 16 },
  link: { color: ON_STAGE, fontSize: 15, fontWeight: '600', padding: spacing.sm },
  modes: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: 2,
    padding: 4,
  },
  modeOption: {
    alignItems: 'center',
    borderRadius: radius.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: spacing.xs,
    paddingVertical: 6,
  },
  modeOptionOn: { backgroundColor: ON_STAGE },
  modeLabel: { color: ON_STAGE_MUTED, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  modeLabelOn: { color: STAGE_BG },
  send: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.xl,
  },
  sendLabel: { ...font.heading, color: colors.primaryText, fontSize: 16 },
}))
