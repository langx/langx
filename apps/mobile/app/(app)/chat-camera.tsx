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
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  ActivityIndicator,
  AppState,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useReduceMotion } from '../../src/hooks/useReduceMotion'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'
import { useT } from '../../src/i18n'
import { showAlert } from '../../src/lib/alert'
import { bakeCameraFilter, deleteCacheFile } from '../../src/lib/bakeCameraFilter'
import {
  CAMERA_FILTER_IDS,
  cameraFilter,
  DEFAULT_CAMERA_FILTER,
  isOriginal,
  type CameraFilterId,
} from '../../src/lib/cameraFilters'
import { impact, notification, selection } from '../../src/lib/haptics'
import { goBackTo } from '../../src/lib/navigation'
import { pickMediaAssets } from '../../src/lib/pickMediaAsset'
import { saveMediaToDevice } from '../../src/lib/saveMedia'
import type { PickedMedia } from '../../src/lib/pickedAssets'
import { sendSnap } from '../../src/lib/snapOutbox'
import { makeStyles, spacing } from '../../src/lib/theme'
import { TIMING } from '../../src/lib/theme/motion'
import { showToast } from '../../src/lib/toast'
import {
  DEFAULT_SNAP_MODE,
  pickSixteenNineSize,
  SNAP_MODES,
  viewOnceForMode,
  type SnapMode,
} from '../../src/lib/viewOnce'
import { useV3Home } from '../../src/hooks/useV3Home'
import {
  FILTER_LABEL,
  FilterNameFlash,
  FilterStrip,
  useFilterSwipe,
} from '../../src/screens/chat/CameraFiltersV3'
import { FilteredPhotoV3 } from '../../src/screens/chat/FilteredPhotoV3'
import {
  CameraPermissionV3,
  LibraryOnlyV3,
  SnapViewfinderV3,
} from '../../src/screens/chat/SnapCameraV3'
import { SnapPreviewV3 } from '../../src/screens/chat/SnapPreviewV3'
import { useCameraZoom } from '../../src/screens/chat/useCameraZoom'
import { FilteredVideoV3 } from '../../src/screens/chat/FilteredVideoV3'
import { canFilterVideo, filterVideo } from '../../modules/video-filter'

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
 * How long the picture stays dimmed after a flip if the camera never says it
 * is ready again: long enough to cover the lens switch's black or frozen frame.
 */
const FLIP_DIM_MS = 400

/**
 * The camera, with its `zoom` fed from the UI thread by the pinch
 * (`useCameraZoom`) rather than through a render per frame.
 */
const AnimatedCamera = Animated.createAnimatedComponent(CameraView)

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
  const v3Look = useV3Home()
  const [captured, setCaptured] = useState<PickedMedia | null>(null)
  /** The shot came from the library, which already holds it: no Save. */
  const [fromLibrary, setFromLibrary] = useState(false)
  const [mode, setMode] = useState<SnapMode>(DEFAULT_SNAP_MODE)
  const [saving, setSaving] = useState(false)
  /*
   * The filter, chosen on the viewfinder and still changeable on the preview,
   * v3 only and native only: the web has no camera to shoot with, and would
   * need CanvasKit's WebAssembly for Skia. What was shot is baked with it on
   * the way out (`outgoing`): a photo by Skia, a clip by `filterVideo`.
   */
  const filtersOn = v3Look && Platform.OS !== 'web'
  const [filter, setFilter] = useState<CameraFilterId>(DEFAULT_CAMERA_FILTER)
  /** Counts changes, so the name flashes again for each, the same filter included. */
  const [filterToken, setFilterToken] = useState(0)
  const [sending, setSending] = useState(false)
  /**
   * The last bake, kept as its promise, so a Save and then a Send draw the
   * shot once even when the second tap lands while the first is drawing.
   */
  const baked = useRef<{
    from: string
    filter: CameraFilterId
    done: Promise<PickedMedia>
  } | null>(null)
  /*
   * Only a JPEG is filtered: a GIF from the library would lose its motion
   * and a PNG its transparency in the JPEG the bake writes. The camera's own
   * shots are always JPEG.
   */
  const photoFilterable =
    filtersOn && captured?.kind === 'image' && captured.contentType === 'image/jpeg'
  /*
   * Only a clip this camera recorded: one from the library may be HEVC, HDR
   * or longer than a re-encode should keep someone waiting, and it opens
   * without a filter anyway. And only in a build that carries the module.
   */
  const videoFilterable =
    filtersOn && captured?.kind === 'video' && !fromLibrary && canFilterVideo()
  const filterable = photoFilterable || videoFilterable

  function pickFilter(next: CameraFilterId): void {
    if (next === filter) return
    void selection()
    setFilter(next)
    setFilterToken((count) => count + 1)
    // The flashed name is hidden from screen readers; this says it instead.
    AccessibilityInfo.announceForAccessibility(t(FILTER_LABEL[next]))
  }

  /** A screen reader's swipe up or down on the preview: the next filter or the one before. */
  function stepFilter(direction: 1 | -1): void {
    const index = CAMERA_FILTER_IDS.indexOf(filter) + direction
    const next = CAMERA_FILTER_IDS[index]
    if (next) pickFilter(next)
  }

  /** The bake's file, deleted once nothing will send it: replaced, or the shot retaken. */
  function discardBake(): void {
    const last = baked.current
    baked.current = null
    void last?.done.then((item) => deleteCacheFile(item.uri)).catch(() => {})
  }

  const previewSwipe = useFilterSwipe({
    // Not while a bake is under way: the photo would go with the filter it left with.
    enabled: filterable && !sending && !saving,
    filter,
    onFilter: pickFilter,
  })

  function pickMode(next: SnapMode): void {
    // The send already read the mode; a change now would not be what goes.
    if (sending) return
    if (next !== mode) void selection()
    setMode(next)
  }

  const frame = frameFor(window.width, window.height - insets.top - insets.bottom)
  // Rounded only when there is stage around it; edge to edge it would cut the corners off.
  const rounded = frame.height < window.height - insets.top - insets.bottom - 1

  function close(): void {
    goBackTo(`/(app)/chat/${conversationId}`)
  }

  function retake(): void {
    // A bake under way ends in a send of this shot; a retake now would be ignored.
    if (sending) return
    discardBake()
    setCaptured(null)
    setFromLibrary(false)
  }

  /*
   * Android's back on the preview is Retake, as the corner's ✕ is and as
   * Instagram's is: it would otherwise close the screen and lose the shot.
   * On the camera itself back still leaves, the navigator's own handling.
   */
  useEffect(() => {
    if (!captured) return
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      retake()
      return true
    })
    return () => subscription.remove()
    // `retake` reads `sending`, so the handler is renewed when that changes.
  }, [captured, sending])

  async function pickFromLibrary(): Promise<void> {
    const picked = await pickMediaAssets({ remaining: 1, source: 'library' })
    if (picked.status === 'denied') {
      void showAlert(t('chat.photosTitle'), t('chat.photosPermission'))
      return
    }
    if (picked.status === 'cancelled') return
    const first = picked.media[0]
    if (first) {
      setFromLibrary(true)
      // A photo from the library opens as it is; the viewfinder's filter was for the camera.
      setFilter(DEFAULT_CAMERA_FILTER)
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

  /**
   * What leaves the screen: the shot itself, or for a filtered photo a new
   * file with the filter drawn into it. Send and Save both go through here,
   * so a view-once photo goes out filtered exactly as the preview showed it,
   * and the unfiltered one is never what is sent. Null when the bake failed,
   * which is said, rather than quietly sending the photo without the filter.
   */
  async function outgoing(): Promise<PickedMedia | null> {
    if (!captured) return null
    if (!filterable || isOriginal(filter)) return captured
    const last = baked.current
    if (!last || last.from !== captured.uri || last.filter !== filter) {
      discardBake()
      const from = captured.uri
      const { matrix } = cameraFilter(filter)
      baked.current = {
        from,
        filter,
        done:
          captured.kind === 'video'
            ? filterVideo(from, matrix, VIDEO_BITRATE).then((uri): PickedMedia => ({
                kind: 'video',
                uri,
                contentType: 'video/mp4',
                ...(captured.durationSeconds !== undefined
                  ? { durationSeconds: captured.durationSeconds }
                  : {}),
              }))
            : bakeCameraFilter(from, matrix).then((out): PickedMedia => ({
                kind: 'image',
                uri: out.uri,
                contentType: 'image/jpeg',
                width: out.width,
                height: out.height,
              })),
      }
    }
    const bake = baked.current
    try {
      return await bake!.done
    } catch {
      // Forgotten, so the next tap tries again rather than failing from the cache.
      if (baked.current === bake) baked.current = null
      void notification('error')
      showToast(t('viewOnce.filterFailed'))
      return null
    }
  }

  /*
   * The shot into the phone's photos, or the browser's downloads — the same
   * write-only path as the photo viewer's Save. Confirmed with a toast: this
   * is a plain stack screen, not a `Modal`, so the root's toast shows above it.
   */
  async function save(): Promise<void> {
    if (!captured || saving) return
    setSaving(true)
    try {
      const item = await outgoing()
      if (!item) return
      const result = await saveMediaToDevice({
        url: item.uri,
        contentType: item.contentType,
      })
      if (result === 'denied') {
        void notification('error')
        void showAlert(t('photo.saveFailed'), t('photo.saveDenied'))
        return
      }
      showToast(t('photo.saved'))
    } catch {
      void notification('error')
      void showAlert(t('photo.saveFailed'), t('common.retry'))
    } finally {
      setSaving(false)
    }
  }

  async function send(): Promise<void> {
    if (!captured || !conversationId || sending) return
    setSending(true)
    const item = await outgoing()
    if (!item) {
      setSending(false)
      return
    }
    sendSnap({ conversationId, item, viewOnce: viewOnceForMode(mode) })
    void impact('light')
    close()
  }

  return (
    <View style={styles.stage}>
      <StatusBar style="light" />
      <View
        style={[
          styles.frame,
          rounded && (v3Look ? styles.frameRoundedV3 : styles.frameRounded),
          {
            top: insets.top,
            left: (window.width - frame.width) / 2,
            width: frame.width,
            height: frame.height,
          },
        ]}
      >
        {captured && v3Look ? (
          // The redesign's drawing of this step only; every handler is this screen's.
          <SnapPreviewV3
            picture={
              filterable ? (
                <GestureDetector gesture={previewSwipe}>
                  <View
                    style={StyleSheet.absoluteFill}
                    collapsable={false}
                    // There is no strip on this step, so a screen reader
                    // steps through the filters here, by swiping up or down.
                    accessible
                    accessibilityRole="adjustable"
                    accessibilityLabel={t('viewOnce.filters')}
                    accessibilityValue={{ text: t(FILTER_LABEL[filter]) }}
                    accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
                    onAccessibilityAction={(event) => {
                      if (sending || saving) return
                      if (event.nativeEvent.actionName === 'increment') stepFilter(1)
                      if (event.nativeEvent.actionName === 'decrement') stepFilter(-1)
                    }}
                  >
                    {captured.kind === 'video' ? (
                      <FilteredVideoV3 uri={captured.uri} matrix={cameraFilter(filter).matrix} />
                    ) : (
                      <FilteredPhotoV3 uri={captured.uri} matrix={cameraFilter(filter).matrix} />
                    )}
                    <FilterNameFlash filter={filter} token={filterToken} />
                  </View>
                </GestureDetector>
              ) : (
                <Captured item={captured} />
              )
            }
            mode={mode}
            bottomInset={rounded ? 0 : insets.bottom}
            onMode={pickMode}
            onRetake={retake}
            onSend={() => void send()}
            saving={saving}
            sending={sending}
            onSave={fromLibrary ? undefined : () => void save()}
          />
        ) : captured ? (
          <SnapPreview
            item={captured}
            mode={mode}
            bottomInset={rounded ? 0 : insets.bottom}
            onMode={pickMode}
            onRetake={retake}
            onSend={() => void send()}
          />
        ) : Platform.OS === 'web' && v3Look ? (
          <LibraryOnlyV3
            bottomInset={rounded ? 0 : insets.bottom}
            onLibrary={() => void pickFromLibrary()}
            onClose={close}
          />
        ) : Platform.OS === 'web' ? (
          <LibraryOnly onLibrary={() => void pickFromLibrary()} onClose={close} />
        ) : (
          <SnapCamera
            bottomInset={rounded ? 0 : insets.bottom}
            onCaptured={(item) => {
              setFromLibrary(false)
              setCaptured(item)
            }}
            onLibrary={() => void pickFromLibrary()}
            onClose={close}
            {...(filtersOn ? { filter, filterToken, onFilter: pickFilter } : {})}
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
  filter = DEFAULT_CAMERA_FILTER,
  filterToken = 0,
  onFilter,
}: {
  bottomInset: number
  onCaptured: (item: PickedMedia) => void
  onLibrary: () => void
  onClose: () => void
  /** Absent where there are no filters: the old look and the web. */
  filter?: CameraFilterId
  filterToken?: number
  onFilter?: (next: CameraFilterId) => void
}) {
  const t = useT()
  const v3Look = useV3Home()
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
  const reduce = useReduceMotion()
  const zoom = useCameraZoom({ flipEnabled: !recording, onDoubleTap: () => flip() })
  /** 1 while a flip's lens switch is under way: the picture dims over it. */
  const dim = useSharedValue(0)
  const dimTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.get() }))
  const swipe = useFilterSwipe({
    enabled: onFilter !== undefined && !recording,
    filter,
    onFilter: (next) => onFilter?.(next),
  })
  // Two fingers are the pinch's, one going sideways the swipe's, two quick taps the flip's.
  const gestures = useMemo(() => Gesture.Race(zoom.gesture, swipe), [zoom.gesture, swipe])
  /*
   * The viewfinder's filter is only a tint laid over the picture: expo-camera
   * hands no frames to JavaScript for a real colour transform to run on. The
   * preview and what is sent get the exact matrix. Kept while recording where
   * the clip will take the filter too, gone where it cannot (`canFilterVideo`).
   */
  const tint = onFilter && (!recording || canFilterVideo()) ? cameraFilter(filter).tint : null

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

  /*
   * Every switch between photo and video, both ways, applies the zoom again:
   * iOS drops it with the session preset, and nothing else would put it back
   * — not on the way into a clip, and not on the way out of one, whether the
   * clip ended, failed or never started. The native side handles the mode and
   * the zoom on one queue in order, so this lands after the switch without
   * waiting for `MODE_SETTLE_MS`.
   */
  useEffect(() => {
    zoom.resend()
    // `zoom` is re-made each render; its `resend` touches only a shared value.
  }, [cameraMode])

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
      if (dimTimer.current) clearTimeout(dimTimer.current)
    },
    [],
  )

  /*
   * The other lens, from the button or a double-tap on the picture. The zoom
   * goes back to 1 first: the other lens has another maximum. The picture
   * dims over the switch, which otherwise shows a black or frozen frame, and
   * clears when the camera is ready again (or after `FLIP_DIM_MS`).
   */
  function flip(): void {
    zoom.reset()
    setFacing((side) => (side === 'back' ? 'front' : 'back'))
    if (reduce) return
    dim.set(withTiming(1, TIMING.exit))
    if (dimTimer.current) clearTimeout(dimTimer.current)
    dimTimer.current = setTimeout(undim, FLIP_DIM_MS)
  }

  function undim(): void {
    if (dimTimer.current) clearTimeout(dimTimer.current)
    dimTimer.current = null
    dim.set(withTiming(0, TIMING.fade))
  }

  function onCameraReady(): void {
    if (dimTimer.current) undim()
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
    void impact('medium')
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
      void notification('error')
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
      void notification('error')
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
    zoom.endSlide()
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

  function allowCamera(): void {
    if (permission?.canAskAgain === false) void Linking.openSettings()
    else void requestPermission().then(() => getPermission())
  }

  if (!permission.granted && v3Look) {
    return (
      <CameraPermissionV3
        canAskAgain={permission.canAskAgain !== false}
        bottomInset={bottomInset}
        onAllow={allowCamera}
        onLibrary={onLibrary}
        onClose={onClose}
      />
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
          onPress={allowCamera}
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

  /*
   * The picture is also the zoom control: pinch it, or double-tap it to flip.
   * The chrome is drawn over it in views of its own, which keep their own
   * touches. A screen reader cannot pinch, so the same surface is an
   * adjustable element — swipe up or down to zoom — and the flip button stays
   * for the same reason the double-tap is not the only way to flip.
   */
  const cameraView = (
    <GestureDetector gesture={gestures}>
      <View
        style={StyleSheet.absoluteFill}
        collapsable={false}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('viewOnce.viewfinder')}
        accessibilityHint={t('viewOnce.viewfinderHint')}
        accessibilityValue={{
          text: zoom.zoomed ? t('viewOnce.zoomedIn') : t('viewOnce.notZoomed'),
        }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') zoom.step(1)
          if (event.nativeEvent.actionName === 'decrement') zoom.step(-1)
        }}
      >
        <AnimatedCamera
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing={facing}
          mode={cameraMode}
          flash={flash}
          enableTorch={recording && flash === 'on'}
          mirror={facing === 'front'}
          mute={muted}
          // On iOS this is the same session preset as the still's 1920x1080
          // `pictureSize`, so a switch to video keeps the capture format, and
          // with it the zoom's scale: the prop means the same magnification in
          // both modes. Only before the sizes are known (or where a camera has
          // no 16:9 size) do the two presets differ.
          videoQuality="1080p"
          videoBitrate={VIDEO_BITRATE}
          // Where the last pinch came to rest, so a render between pinches
          // carries the zoom rather than expo-camera's default of 0; while the
          // fingers move, `animatedProps` carries it without a render.
          zoom={zoom.zoom}
          animatedProps={zoom.animatedProps}
          // Android fits a 16:9 preview into the 9:16 frame; iOS fills the frame
          // and takes the 16:9 still from `pictureSize`.
          {...(Platform.OS === 'android' ? { ratio: '16:9' as const } : {})}
          {...(pictureSize ? { pictureSize } : {})}
          onCameraReady={onCameraReady}
          onMountError={() => {
            void notification('error')
            showToast(t('viewOnce.captureFailed'))
          }}
        />
        {tint ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} pointerEvents="none" />
        ) : null}
        <Animated.View
          style={[StyleSheet.absoluteFill, styles.flipDim, dimStyle]}
          pointerEvents="none"
        />
        {onFilter ? <FilterNameFlash filter={filter} token={filterToken} /> : null}
      </View>
    </GestureDetector>
  )

  if (v3Look) {
    return (
      <SnapViewfinderV3
        camera={cameraView}
        recording={recording}
        elapsed={elapsed}
        flashOn={flash === 'on'}
        bottomInset={bottomInset}
        onClose={onClose}
        onFlash={() => setFlash((on) => (on === 'on' ? 'off' : 'on'))}
        onLibrary={onLibrary}
        onFlip={flip}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onSlide={zoom.slide}
        filterStrip={onFilter ? <FilterStrip filter={filter} onFilter={onFilter} /> : undefined}
      />
    )
  }

  return (
    <>
      {cameraView}

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
            onPress={flip}
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
      <Captured item={item} />
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
        {/* A paper plane and no word, as Instagram's is; the word stays for
            screen readers. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('viewOnce.send')}
          onPress={onSend}
          style={({ pressed }) => [styles.send, pressed && styles.pressed]}
        >
          <Feather name="send" size={24} color={styles.sendIcon.color} style={styles.sendIcon} />
        </Pressable>
      </View>
    </>
  )
}

/** What was shot, filling the frame: the photo, or the clip on a loop. */
function Captured({ item }: { item: PickedMedia }) {
  return item.kind === 'video' ? (
    <PreviewVideo uri={item.uri} />
  ) : (
    <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
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

const useStyles = makeStyles(({ colors, font, radius, v3 }) => ({
  stage: { backgroundColor: STAGE_BG, flex: 1 },
  frame: { backgroundColor: STAGE_BG, overflow: 'hidden', position: 'absolute' },
  frameRounded: { borderRadius: radius.lg },
  // The preview panel's radius family.
  frameRoundedV3: { borderRadius: v3.radius.card },
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
  // Over the picture during a flip; black in both schemes, like the stage.
  flipDim: { backgroundColor: 'rgba(0, 0, 0, 0.6)' },
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
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  // The plane's point is up and to the right, so its box sits off-centre;
  // nudged back so it reads as centred in the circle.
  sendIcon: { color: colors.primaryText, marginLeft: -2, marginTop: 2 },
}))
