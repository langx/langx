import Feather from '@expo/vector-icons/Feather'
import { useEvent, useEventListener } from 'expo'
import { Image } from 'expo-image'
import { usePathname } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  AccessibilityInfo,
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useTourOpen } from '../hooks/useTour'
import { useVenusStory } from '../hooks/useVenusStory'
import { noteVenusWatched } from '../hooks/useVenusWatched'
import { useT } from '../i18n'
import { authClient } from '../lib/auth-client'
import { showAlert } from '../lib/alert'
import { claimCelebration } from '../lib/celebration'
import { notification } from '../lib/haptics'
import { isLaunchOver, subscribeToLaunchOver } from '../lib/launchOver'
import { FLAG_KEYS, readJsonFlag, writeJsonFlag } from '../lib/localFlags'
import { AXIS_LOCK_PX, DISMISS_SCALE, DISMISS_SCRIM, dismissProgress } from '../lib/pinch'
import { isProWelcomeOpen, subscribeToProWelcomeOpen } from '../lib/proWelcome'
import { DISPLAY_FONT, makeStyles, useTheme } from '../lib/theme'
import { SPRING, STAGGER, TIMING, unlessReduced } from '../lib/theme/motion'
import {
  canShareVenusFile,
  prepareVenusShare,
  saveVenusVideo,
  shareVenusVideo,
  type VenusShareCopy,
} from '../lib/venusShare'
import {
  closesVenusStory,
  hasWatchedVenus,
  isVenusAutoOpenPath,
  isVenusIntroFilm,
  markVenusSeen,
  setVenusStoryOpen,
  shouldAutoOpenVenus,
  subscribeToVenusReplay,
  venusFrameFor,
  venusReplayRequests,
  venusRequestedClip,
  venusShareFileName,
  type VenusClip,
  type VenusSeen,
} from '../lib/venusStory'
import { useBlackFont } from './onboarding/WizardV3'
import { Button } from './ui/Button'
import { FlameGlyph } from './ui/StreakFlame'

/**
 * Venus's daily streak story, behind `flags.venusStories`.
 *
 * Opens by itself once per account per counted day — the first time this
 * device sees today's streak count — and again whenever the streak flame
 * asks for it (`requestVenusReplay`), until midnight in the profile's
 * timezone; then it waits for the next day to count (`venusVideoFor`).
 *
 * Here at the root of the signed-in area, beside "You're Pro now", because
 * the day counts wherever the person happens to be — usually the moment a
 * message goes. The opening itself waits for a tab (`isVenusAutoOpenPath`),
 * and for the launch film, the Discover tour and "You're Pro now" to be gone:
 * each is a window of its own and the second to open paints over the first.
 *
 * With no file for the day — which, until the bucket is filled, is every day
 * — `useVenusStory` answers `null` and nothing here draws or says anything.
 *
 * It also plays any other day on request (`requestVenusClip`): a day from the
 * archive on the streak page or the Venus page, or the introduction film,
 * which gives way to day 1 when its file will not load. Such a day has no
 * `dayKey` — it is not the day that counted — so nothing about it is
 * recorded against today (see `VenusStoryPlayer`).
 */
export function VenusStoryHost({ enabled }: { enabled: boolean }) {
  const video = useVenusStory()
  const { data: session } = authClient.useSession()
  const accountId = session?.user.id
  const pathname = usePathname()
  const launchOver = useSyncExternalStore(subscribeToLaunchOver, isLaunchOver, isLaunchOver)
  const welcomeOpen = useSyncExternalStore(
    subscribeToProWelcomeOpen,
    isProWelcomeOpen,
    isProWelcomeOpen,
  )
  const tourOpen = useTourOpen()
  const replays = useSyncExternalStore(
    subscribeToVenusReplay,
    venusReplayRequests,
    venusReplayRequests,
  )
  const [open, setOpen] = useState<{
    video: VenusClip
    /** Today's counted day, or `null` for any other day's video. */
    dayKey: string | null
    auto: boolean
  } | null>(null)

  // The seen map is read once per account: the auto-open has to wait for it,
  // or a cold start would open the video before learning it already had.
  const [seen, setSeen] = useState<{ accountId: string; map: VenusSeen | null } | null>(null)
  useEffect(() => {
    if (!accountId) return
    let cancelled = false
    void readJsonFlag<VenusSeen>(FLAG_KEYS.venusStorySeen).then((map) => {
      if (!cancelled) setSeen({ accountId, map })
    })
    return () => {
      cancelled = true
    }
  }, [accountId])

  const canOpen = enabled && launchOver && !tourOpen && !welcomeOpen
  const seenMap = seen?.accountId === accountId ? seen : null
  useEffect(() => {
    if (!canOpen || open || !seenMap || !accountId) return
    if (!isVenusAutoOpenPath(pathname)) return
    if (!shouldAutoOpenVenus(video, seenMap.map, accountId)) return
    const map = markVenusSeen(seenMap.map, accountId, video.dayKey)
    setSeen({ accountId, map })
    void writeJsonFlag(FLAG_KEYS.venusStorySeen, map)
    setOpen({ video, dayKey: video.dayKey, auto: true })
  }, [canOpen, open, seenMap, accountId, pathname, video])

  // A tap on the flame, or on a day in the archive. Only the requests made
  // after this mounted count.
  const handledReplays = useRef(replays)
  useEffect(() => {
    if (replays === handledReplays.current) return
    handledReplays.current = replays
    if (!enabled) return
    const clip = venusRequestedClip()
    if (clip) setOpen({ video: clip, dayKey: null, auto: false })
    else if (video) setOpen({ video, dayKey: video.dayKey, auto: false })
  }, [replays, enabled, video])

  if (!open) return null
  return (
    <VenusStoryPlayer
      // A new day asked for while one is open starts a new player, rather
      // than handing a playing one a different file.
      key={open.video.url}
      video={open.video}
      dayKey={open.dayKey}
      autoOpened={open.auto}
      accountId={accountId}
      onClose={() => setOpen(null)}
      // The introduction film falls back to day 1 (`venusIntroFilm`); any
      // other file that will not load closes the player.
      onFail={() => setOpen(open.video.fallback ? { ...open, video: open.video.fallback } : null)}
    />
  )
}

/**
 * The player: full screen, like a story, with the day's cover on either side
 * of the video.
 *
 * **Before the first frame** the cover is the picture — the day's still,
 * `coverUrl` — so the screen opens on Venus rather than on black while the
 * file starts, and it dissolves into the video once that is playing. A day
 * with no cover opens on the stage, as before.
 *
 * **During** it there is no button over the picture, only the progress bar,
 * the ✕ and, on the web, the sound pill: a button from the first frame pulls
 * the eye off Venus before her line lands. A tap anywhere pauses and resumes.
 * The one exception is a replay of a video this account has already watched
 * through today (`hasWatchedVenus`), which keeps a small Share beside the ✕ —
 * somebody who taps the flame again is often back for the button.
 *
 * **At the end** the video gives way to the cover again, and the end panel
 * rises over its foot: the streak, the day, Share — the screen's one yellow,
 * because sending it on is what the video is for — Save beside Watch again,
 * and the ✕ still at the top. Without a cover the last frame holds. A tap on
 * the picture plays it again. The first time a day is watched through, the
 * panel lands with one success haptic, as a celebration does.
 *
 * The picture fills the screen (`venusFrameFor`): a phone taller than 9:16
 * loses a sliver of each side and keeps one strip at the top, under the
 * status bar; a wide screen gets the whole picture, centred. The chrome lines
 * up with the part of the picture on screen.
 *
 * On the web the video starts muted, because a browser refuses to start one
 * with sound that the person did not press play on, so the first tap there
 * turns the sound on instead and says so in the pill. Native starts with
 * sound, as a story does.
 *
 * **A drag down closes it**, as it closes the photo viewer and at the same
 * line (`closesVenusStory`), besides the ✕ and Android's back. The story
 * follows the finger and the ground fades, so the screen it opened over shows
 * through; let go short of the line and it springs home. Either way out goes
 * through the same `onClose`, so what closing does is the same for each.
 *
 * With reduce motion on, nothing moves by itself: the screen and the panel
 * appear without a transition, an automatic opening waits on the cover for a
 * tap — a moving picture that starts by itself is exactly what that setting
 * asks not to get — and a drag past the line closes the story where it is
 * rather than throwing it off the screen. A tap on the flame is a request to
 * watch, and plays at once either way.
 *
 * **Another day's video** (`dayKey` null) — the archive's, the introduction —
 * plays the same way, but is not today's: watching it through records nothing
 * and celebrates nothing, and its end panel carries no streak chip, since the
 * day it shows is not the streak the person is on.
 */
function VenusStoryPlayer({
  video,
  dayKey,
  autoOpened,
  accountId,
  onClose,
  onFail,
}: {
  video: VenusClip
  dayKey: string | null
  autoOpened: boolean
  accountId: string | undefined
  onClose: () => void
  /** The file will not play. */
  onFail: () => void
}) {
  const t = useT()
  const styles = useStyles()
  const { colors, v3 } = useTheme()
  const insets = useSafeAreaInsets()
  const screen = useWindowDimensions()
  const reduce = useReduceMotion()
  const black = useBlackFont()
  const startsMuted = Platform.OS === 'web'
  const holdFirstFrame = autoOpened && reduce

  const frame = venusFrameFor(screen.width, screen.height)
  // The part of the picture that is on screen: the chrome lines up with it,
  // not with an edge cut off on a phone or a desktop window's empty sides.
  const visibleLeft = Math.max(0, frame.left)
  const visibleWidth = Math.min(frame.width, screen.width)

  const player = useVideoPlayer(video.url, (instance) => {
    instance.muted = startsMuted
    instance.loop = false
    instance.timeUpdateEventInterval = 0.1
    if (!holdFirstFrame) instance.play()
  })
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing })
  const { muted } = useEvent(player, 'mutedChange', { muted: player.muted })
  const { status } = useEvent(player, 'statusChange', { status: player.status })
  const [progress, setProgress] = useState(0)
  const [ended, setEnded] = useState(false)
  // The first frame is on screen and the video has started: the cover can go.
  const [firstFrame, setFirstFrame] = useState(false)
  const [rolling, setRolling] = useState(false)
  const [cover, setCover] = useState<'loading' | 'ready' | 'failed'>(
    video.coverUrl ? 'loading' : 'failed',
  )
  // Watched through today, on this device or in this sitting: Share stays.
  const [watchedBefore, setWatchedBefore] = useState(false)
  const [watched, setWatched] = useState(false)

  useEffect(() => {
    setVenusStoryOpen(true)
    return () => setVenusStoryOpen(false)
  }, [])

  useEffect(() => {
    if (!dayKey) return
    let cancelled = false
    void readJsonFlag<VenusSeen>(FLAG_KEYS.venusStoryWatched).then((map) => {
      if (!cancelled && hasWatchedVenus(map, accountId, dayKey)) setWatchedBefore(true)
    })
    return () => {
      cancelled = true
    }
  }, [accountId, dayKey])

  useEffect(() => {
    if (firstFrame && isPlaying) setRolling(true)
  }, [firstFrame, isPlaying])

  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (player.duration > 0) setProgress(Math.min(1, currentTime / player.duration))
  })
  useEventListener(player, 'playToEnd', () => {
    setEnded(true)
    setProgress(1)
    if (watched) return
    setWatched(true)
    // Another day's video is not today's, so it neither celebrates nor marks
    // today's as watched.
    if (!dayKey) return
    // Once per day per run, and not for a day already watched through here.
    if (!watchedBefore && claimCelebration(`venus:${dayKey}`)) void notification('success')
    if (!accountId) return
    // Through the store, so Home's streak row under this hears it at once.
    void noteVenusWatched(accountId, dayKey)
  })

  // A file that is listed but will not play closes quietly, or gives way to
  // its fallback: an error toast over a missing video is the one thing this
  // feature must never show.
  useEffect(() => {
    if (status === 'error') onFail()
  }, [status, onFail])

  /*
   * Started again once the file is ready. On the web the `play()` in the
   * setup runs before the `<video>` element exists and is dropped, so the
   * story sat on its first frame; native ignores a second `play()`.
   */
  const started = useRef(false)
  useEffect(() => {
    if (status !== 'readyToPlay' || started.current || holdFirstFrame) return
    started.current = true
    player.play()
  }, [status, holdFirstFrame, player])

  // Not for the introduction film: at ~50 MB, fetching it ahead would double
  // what the web downloads on every open and keep it in memory for the
  // session. Sharing it still works; it fetches when asked.
  useEffect(() => {
    if (!isVenusIntroFilm(video)) prepareVenusShare(video.url)
  }, [video])

  // The cover dissolves into the first frame and back over the last.
  const showCover = cover !== 'failed' && (!rolling || ended)
  const coverOpacity = useSharedValue(1)
  useEffect(() => {
    const to = showCover ? 1 : 0
    coverOpacity.set(reduce ? to : withTiming(to, TIMING.crossfade))
  }, [showCover, reduce, coverOpacity])
  const coverStyle = useAnimatedStyle(() => ({ opacity: coverOpacity.get() }))

  // The panel rises once the cover has begun to come back, and the streak
  // chip lands on it with one bounce.
  const rise = useSharedValue(0)
  const pop = useSharedValue(0)
  useEffect(() => {
    if (!ended) {
      rise.set(0)
      pop.set(0)
      return
    }
    rise.set(reduce ? 1 : withDelay(120, withSpring(1, SPRING.sheet)))
    pop.set(reduce ? 1 : withDelay(120 + STAGGER * 2, withSpring(1, SPRING.bounce)))
  }, [ended, reduce, rise, pop])
  const panelStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, rise.get() * 1.5),
    transform: [{ translateY: (1 - rise.get()) * 48 }],
  }))
  const chipStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, pop.get() * 2),
    transform: [{ scale: 0.6 + 0.4 * pop.get() }],
  }))

  /*
   * The drag down, done the way `PhotoViewer` does it so the two feel like
   * one gesture: the story follows the finger — sideways at a third — and
   * eases back from the screen as the ground fades by `dismissProgress`;
   * past the line it is thrown off the bottom over `TIMING.exit` and then
   * closed. Down only: an upward pull leaves it where it is.
   */
  const dragX = useSharedValue(0)
  const dragY = useSharedValue(0)
  /**
   * 0 until a close is committed, then 1 over the throw: the ground finishes
   * fading on it, so the story leaves the screen it opened over behind rather
   * than a stage that vanishes a frame after it.
   */
  const leaving = useSharedValue(0)
  /**
   * Whether the pointer now down has turned into a drag, on the web only.
   * There the browser still sends the picture's press a click when a mouse
   * is let go after dragging, and a story pulled and let back took that for
   * a tap — paused, or turned the sound on. Native cancels the press itself
   * once the pan takes the touch, so there it stays false and cannot swallow
   * a later press that no touch began, such as a screen reader's.
   */
  const dragged = useSharedValue(false)
  const screenHeight = screen.height
  // Memoised: the player re-renders ten times a second for the progress bar,
  // and every fresh gesture object is its config and callbacks handed to the
  // native handler again, mid-drag included.
  const swipeDown = useMemo(
    () =>
      Gesture.Pan()
        // Only downwards, and only once the finger has travelled, so a tap
        // still pauses and plays.
        .activeOffsetY(AXIS_LOCK_PX)
        .onBegin(() => {
          dragged.set(false)
        })
        .onStart(() => {
          if (CLICK_AFTER_DRAG) dragged.set(true)
        })
        .onChange((event) => {
          dragX.set(event.translationX / 3)
          dragY.set(Math.max(0, event.translationY))
        })
        .onEnd((event, success) => {
          if (success && closesVenusStory(event.translationY, event.velocityY)) {
            if (reduce) {
              runOnJS(onClose)()
              return
            }
            leaving.set(withTiming(1, TIMING.exit))
            // Closed whether or not the throw finished: a finger landing
            // mid-throw must not strand an empty player on screen.
            dragY.set(withTiming(screenHeight, TIMING.exit, () => runOnJS(onClose)()))
            return
          }
          const home = (to: number): number => withSpring(to, SPRING.snap)
          dragX.set(unlessReduced(reduce, 0, home))
          dragY.set(unlessReduced(reduce, 0, home))
        }),
    [reduce, screenHeight, onClose, dragX, dragY, leaving, dragged],
  )
  const storyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: dragX.get() },
      { translateY: dragY.get() },
      {
        scale: interpolate(dismissProgress(dragY.get(), screenHeight), [0, 1], [1, DISMISS_SCALE]),
      },
    ],
  }))
  const groundStyle = useAnimatedStyle(() => ({
    opacity:
      interpolate(dismissProgress(dragY.get(), screenHeight), [0, 1], [1, DISMISS_SCRIM]) *
      (1 - leaving.get()),
  }))

  function replay(): void {
    setEnded(false)
    setProgress(0)
    player.replay()
  }

  function onTap(): void {
    if (muted) {
      player.muted = false
      if (!isPlaying) player.play()
      return
    }
    if (ended) return replay()
    if (isPlaying) player.pause()
    else player.play()
  }

  const copy = useMemo<VenusShareCopy>(() => {
    const title = t('venus.endTitle', { day: video.day })
    return { title, shareName: venusShareFileName(title) }
  }, [t, video.day])
  // A browser that cannot hand a file to a share sheet only downloads it, so
  // there the one button says so and Save would be the same button twice.
  const canShareFile = useMemo(canShareVenusFile, [])

  /*
   * How each action ended is said on its own button — a check and the words
   * for a moment — or, for a failure, in an alert. Not a toast: `ToastHost`
   * is at the root, and this `Modal` is drawn over everything there, so a
   * toast would land behind the player it is about (`PhotoViewer` hit the
   * same wall).
   */
  const [done, setDone] = useState<{ button: 'share' | 'save'; label: string } | null>(null)
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => clearTimeout(doneTimer.current ?? undefined), [])
  function confirm(button: 'share' | 'save', label: string): void {
    clearTimeout(doneTimer.current ?? undefined)
    setDone({ button, label })
    AccessibilityInfo.announceForAccessibility(label)
    doneTimer.current = setTimeout(() => setDone(null), 1500)
  }

  const [sharing, setSharing] = useState(false)
  async function onShare(): Promise<void> {
    if (sharing) return
    setSharing(true)
    player.pause()
    const result = await shareVenusVideo(video.url, video.fileName, copy, () => setSharing(false))
    setSharing(false)
    if (result === 'downloaded') confirm('share', t('venus.downloaded'))
    else if (result === 'copied') confirm('share', t('share.copied'))
    else if (result === 'failed') await showAlert(t('venus.shareFailed'))
  }

  const [saving, setSaving] = useState(false)
  async function onSave(): Promise<void> {
    if (saving) return
    setSaving(true)
    const result = await saveVenusVideo(video.url, video.fileName, copy)
    setSaving(false)
    if (result === 'saved') confirm('save', t('photo.saved'))
    else if (result === 'downloaded') confirm('save', t('venus.downloaded'))
    else if (result === 'denied') await showAlert(t('photo.saveFailed'), t('photo.saveDenied'))
    else await showAlert(t('photo.saveFailed'), t('common.retry'))
  }

  const paused = !isPlaying && !muted && !ended && (rolling || holdFirstFrame)
  const shareInBar = (watchedBefore || watched) && !ended

  return (
    <Modal
      visible
      // Transparent rather than full-screen: a drag down fades the ground to
      // show the screen the story opened over, and an opaque window would
      // show its own blank background there instead. At rest the ground
      // covers everything, as before.
      transparent
      animationType={reduce ? 'none' : 'fade'}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/*
        A root of its own: a `Modal` is a separate native window, outside the
        `GestureHandlerRootView` in `app/_layout.tsx`, and without one here
        Android delivers the drag to nothing at all — as `PhotoViewer` found.
      */}
      <GestureHandlerRootView style={styles.root}>
        {/*
          The clock and battery in light over the stage, in either scheme, as
          the call screen and the recap set theirs: in light mode the app's
          are dark, and on the stage they all but vanished. Unmounted with the
          player, the app's own come back.
        */}
        <StatusBar style="light" />
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.stage }, groundStyle]}
        />
        <Animated.View
          style={[styles.root, storyStyle]}
          accessibilityViewIsModal
          accessibilityLabel={t('venus.playerA11y', { day: video.day })}
        >
          {/*
            Only the picture and its tap take the drag. The ✕, Share and the
            end panel sit outside it, as they do in `PhotoViewer` and the
            recap, so a touch that starts on a button is always that button.
          */}
          <GestureDetector gesture={swipeDown}>
            <View style={StyleSheet.absoluteFill}>
              <View
                style={[
                  styles.frame,
                  { height: frame.height, left: frame.left, top: frame.top, width: frame.width },
                  frame.top > 0 && styles.frameBelowBar,
                ]}
                pointerEvents="none"
              >
                <VideoView
                  player={player}
                  style={styles.fill}
                  contentFit="cover"
                  nativeControls={false}
                  allowsVideoFrameAnalysis={false}
                  onFirstFrameRender={() => setFirstFrame(true)}
                />
                {video.coverUrl && cover !== 'failed' ? (
                  <Animated.View style={[StyleSheet.absoluteFill, coverStyle]}>
                    <Image
                      source={video.coverUrl}
                      style={styles.fill}
                      contentFit="cover"
                      accessible={false}
                      onLoad={() => setCover('ready')}
                      onError={() => setCover('failed')}
                    />
                  </Animated.View>
                ) : null}
              </View>

              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => {
                  // Pulled and let back: not a tap. See `dragged`.
                  if (dragged.get()) {
                    dragged.set(false)
                    return
                  }
                  onTap()
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  muted
                    ? t('venus.tapForSound')
                    : ended
                      ? t('venus.replay')
                      : isPlaying
                        ? t('venus.pause')
                        : t('venus.play')
                }
              >
                {paused ? (
                  <View style={styles.centre} pointerEvents="none">
                    <View style={[styles.disc, styles.playDisc, { backgroundColor: colors.scrim }]}>
                      <Feather name="play" size={36} color={colors.onScrim} />
                    </View>
                  </View>
                ) : null}
              </Pressable>
            </View>
          </GestureDetector>

          <View
            style={[
              styles.top,
              {
                left: visibleLeft,
                top: Math.max(insets.top, frame.top) + v3.space[8],
                width: visibleWidth,
              },
            ]}
            pointerEvents="box-none"
          >
            <View style={styles.track} pointerEvents="none">
              <View
                style={[
                  styles.progress,
                  {
                    backgroundColor: colors.onScrim,
                    width: `${Math.round(progress * 1000) / 10}%`,
                  },
                ]}
              />
            </View>
            <View style={styles.topRow} pointerEvents="box-none">
              {muted ? (
                <Pressable
                  onPress={onTap}
                  accessibilityRole="button"
                  style={[styles.pill, { backgroundColor: colors.scrim }]}
                >
                  <Feather name="volume-x" size={16} color={colors.onScrim} />
                  <Text style={[styles.pillText, { color: colors.onScrim }]}>
                    {t('venus.tapForSound')}
                  </Text>
                </Pressable>
              ) : (
                <View />
              )}
              <View style={styles.corner} pointerEvents="box-none">
                {shareInBar ? (
                  <Pressable
                    onPress={() => void onShare()}
                    accessibilityRole="button"
                    accessibilityLabel={t('venus.share')}
                    accessibilityState={{ busy: sharing }}
                    hitSlop={8}
                    style={[styles.disc, { backgroundColor: colors.scrim }]}
                  >
                    {sharing ? (
                      <ActivityIndicator color={colors.onScrim} />
                    ) : (
                      <Feather
                        name={canShareFile ? 'share' : 'download'}
                        size={20}
                        color={colors.onScrim}
                      />
                    )}
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={onClose}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.close')}
                  hitSlop={12}
                  style={[styles.disc, { backgroundColor: colors.scrim }]}
                >
                  <Feather name="x" size={22} color={colors.onScrim} />
                </Pressable>
              </View>
            </View>
          </View>

          {ended ? (
            <Animated.View
              style={[styles.panelWrap, { left: visibleLeft, width: visibleWidth }, panelStyle]}
              pointerEvents="box-none"
            >
              <View style={[styles.panel, { paddingBottom: insets.bottom + v3.space[16] }]}>
                {dayKey ? (
                  <Animated.View
                    style={[styles.chip, { backgroundColor: v3.hues.tangerine }, chipStyle]}
                  >
                    <FlameGlyph size={v3.icon.xs} color={v3.colors.ink} />
                    <Text style={styles.chipText}>
                      {t('venus.endStreak', { count: video.day })}
                    </Text>
                  </Animated.View>
                ) : null}
                <Text
                  accessibilityRole="header"
                  style={[styles.title, !black && styles.titleFallback]}
                >
                  {copy.title}
                </Text>
                <Text style={styles.body}>{t('venus.endBody')}</Text>
                <View style={styles.actions}>
                  <Button
                    variant="primary"
                    icon={canShareFile ? 'share' : 'download'}
                    label={
                      done?.button === 'share'
                        ? done.label
                        : canShareFile
                          ? t('venus.shareVideo')
                          : t('venus.downloadVideo')
                    }
                    loading={sharing}
                    success={done?.button === 'share'}
                    onPress={() => void onShare()}
                  />
                  <View style={styles.row}>
                    {canShareFile ? (
                      <Button
                        style={styles.half}
                        variant="secondary"
                        size="medium"
                        icon="download"
                        label={done?.button === 'save' ? done.label : t('photo.save')}
                        loading={saving}
                        success={done?.button === 'save'}
                        onPress={() => void onSave()}
                      />
                    ) : null}
                    <Button
                      style={styles.half}
                      variant="secondary"
                      size="medium"
                      icon="rotate-ccw"
                      label={t('venus.replay')}
                      onPress={replay}
                    />
                  </View>
                </View>
              </View>
            </Animated.View>
          ) : null}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  )
}

/** See `dragged`. */
const CLICK_AFTER_DRAG = Platform.OS === 'web'

const useStyles = makeStyles(({ v3 }) => ({
  root: { flex: 1, overflow: 'hidden' },
  frame: { overflow: 'hidden', position: 'absolute' },
  // On a phone the picture starts under the status bar: its top corners are
  // rounded there, as a story's are, so the strip above reads as the frame's
  // edge rather than as a bar.
  frameBelowBar: { borderTopLeftRadius: v3.radius.icon, borderTopRightRadius: v3.radius.icon },
  /*
   * A size, not just four edges: on the web the style lands on the `<video>`
   * itself, and a replaced element pinned at all four edges keeps its
   * intrinsic 1080 × 1920 rather than stretching to them.
   */
  fill: { height: '100%', position: 'absolute', start: 0, top: 0, width: '100%' },
  centre: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  disc: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  playDisc: { height: 80, paddingStart: v3.space[4], width: 80 },
  top: { gap: v3.space[10], paddingHorizontal: v3.space[12], position: 'absolute' },
  track: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 2,
    height: 3,
    overflow: 'hidden',
  },
  progress: { height: 3 },
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  corner: { flexDirection: 'row', gap: v3.space[8] },
  pill: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[6],
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[6],
  },
  pillText: { ...v3.type.callout, fontWeight: '700' },
  panelWrap: { alignItems: 'center', bottom: 0, position: 'absolute' },
  panel: {
    backgroundColor: v3.colors.bg,
    borderTopEndRadius: v3.radius.block,
    borderTopStartRadius: v3.radius.block,
    gap: v3.space[8],
    maxWidth: 560,
    paddingHorizontal: v3.space[20],
    paddingTop: v3.space[20],
    width: '100%',
  },
  chip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[6],
    paddingHorizontal: v3.space[10],
    paddingVertical: v3.space[4],
  },
  chipText: { ...v3.type.label, color: v3.colors.ink },
  title: { ...v3.type.title, color: v3.colors.fg, marginTop: v3.space[4] },
  titleFallback: { fontFamily: DISPLAY_FONT },
  body: { ...v3.type.callout, color: v3.colors.muted },
  actions: { gap: v3.space[10], marginTop: v3.space[12] },
  // Wraps rather than squeezes: two long labels ("Speichern" beside
  // "Nochmal ansehen" on a 375pt phone) would otherwise break mid-word, so
  // when they do not fit side by side each takes a full line of its own.
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[10] },
  // Grown from each label's own width rather than split in halves. `width:
  // 'auto'` undoes Button's full-width default, which inside a row pushes
  // the second button off the screen.
  half: { width: 'auto', flexGrow: 1 },
}))
