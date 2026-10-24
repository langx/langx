import Feather from '@expo/vector-icons/Feather'
import { useEvent, useEventListener } from 'expo'
import { usePathname } from 'expo-router'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useTourOpen } from '../hooks/useTour'
import { useVenusStory } from '../hooks/useVenusStory'
import { useT } from '../i18n'
import { authClient } from '../lib/auth-client'
import { isLaunchOver, subscribeToLaunchOver } from '../lib/launchOver'
import { FLAG_KEYS, readJsonFlag, writeJsonFlag } from '../lib/localFlags'
import { isProWelcomeOpen, subscribeToProWelcomeOpen } from '../lib/proWelcome'
import { makeStyles, useTheme } from '../lib/theme'
import { showToast } from '../lib/toast'
import { prepareVenusShare, shareVenusVideo } from '../lib/venusShare'
import {
  isVenusAutoOpenPath,
  markVenusSeen,
  shouldAutoOpenVenus,
  subscribeToVenusReplay,
  venusReplayRequests,
  type VenusSeen,
  type VenusVideo,
} from '../lib/venusStory'
import { Button } from './ui/Button'

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
  const [open, setOpen] = useState<{ video: VenusVideo; auto: boolean } | null>(null)

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
    setOpen({ video, auto: true })
  }, [canOpen, open, seenMap, accountId, pathname, video])

  // A tap on the flame. Only the requests made after this mounted count.
  const handledReplays = useRef(replays)
  useEffect(() => {
    if (replays === handledReplays.current) return
    handledReplays.current = replays
    if (enabled && video) setOpen({ video, auto: false })
  }, [replays, enabled, video])

  if (!open) return null
  return (
    <VenusStoryPlayer video={open.video} autoOpened={open.auto} onClose={() => setOpen(null)} />
  )
}

/**
 * The player: full screen, like a story. A progress bar along the top, the
 * close ✕ at the top's end, Share at the bottom — the one button on the
 * screen, because sending it on is what the video is for.
 *
 * A tap anywhere else pauses and resumes. On the web the video starts muted,
 * because a browser refuses to start one with sound that the person did not
 * press play on, so the first tap there turns the sound on instead and says
 * so in the pill. Native starts with sound, as a story does.
 *
 * With reduce motion on, the screen appears without a transition and an
 * automatic opening waits on its first frame for a tap: a moving picture
 * that starts by itself is exactly what that setting asks not to get. A tap
 * on the flame is a request to watch, and plays at once either way.
 */
function VenusStoryPlayer({
  video,
  autoOpened,
  onClose,
}: {
  video: VenusVideo
  autoOpened: boolean
  onClose: () => void
}) {
  const t = useT()
  const styles = useStyles()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const reduce = useReduceMotion()
  const startsMuted = Platform.OS === 'web'
  const holdFirstFrame = autoOpened && reduce

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
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (player.duration > 0) setProgress(Math.min(1, currentTime / player.duration))
  })
  useEventListener(player, 'playToEnd', () => {
    setEnded(true)
    setProgress(1)
  })

  // A file that is listed but will not play closes quietly: an error toast
  // over a missing video is the one thing this feature must never show.
  useEffect(() => {
    if (status === 'error') onClose()
  }, [status, onClose])

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

  useEffect(() => {
    prepareVenusShare(video.url)
  }, [video.url])

  function onTap(): void {
    if (muted) {
      player.muted = false
      if (!isPlaying) player.play()
      return
    }
    if (ended) {
      setEnded(false)
      setProgress(0)
      player.replay()
      return
    }
    if (isPlaying) player.pause()
    else player.play()
  }

  const [sharing, setSharing] = useState(false)
  async function onShare(): Promise<void> {
    setSharing(true)
    player.pause()
    const result = await shareVenusVideo(video.url, video.fileName)
    setSharing(false)
    if (result === 'downloaded') showToast(t('venus.downloaded'))
    else if (result === 'copied') showToast(t('share.copied'))
    else if (result === 'failed') showToast(t('venus.shareFailed'))
  }

  return (
    <Modal
      visible
      animationType={reduce ? 'none' : 'fade'}
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View
        style={[styles.root, { backgroundColor: colors.stage }]}
        accessibilityViewIsModal
        accessibilityLabel={t('venus.playerA11y', { day: video.day })}
      >
        <VideoView
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls={false}
          allowsVideoFrameAnalysis={false}
          pointerEvents="none"
        />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onTap}
          accessibilityRole="button"
          accessibilityLabel={
            muted ? t('venus.tapForSound') : isPlaying ? t('venus.pause') : t('venus.play')
          }
        >
          {!isPlaying && !muted ? (
            <View style={styles.centre} pointerEvents="none">
              <View style={[styles.playDisc, { backgroundColor: colors.scrim }]}>
                <Feather name="play" size={36} color={colors.onScrim} />
              </View>
            </View>
          ) : null}
        </Pressable>

        <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <View style={styles.track} pointerEvents="none">
            <View
              style={[
                styles.fill,
                { backgroundColor: colors.onScrim, width: `${Math.round(progress * 1000) / 10}%` },
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
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              hitSlop={12}
              style={[styles.close, { backgroundColor: colors.scrim }]}
            >
              <Feather name="x" size={22} color={colors.onScrim} />
            </Pressable>
          </View>
        </View>

        <View
          style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}
          pointerEvents="box-none"
        >
          <Button
            variant="primary"
            icon="share"
            label={t('venus.share')}
            loading={sharing}
            onPress={() => void onShare()}
          />
        </View>
      </View>
    </Modal>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  root: { flex: 1 },
  /*
   * A size, not just four edges: on the web the style lands on the `<video>`
   * itself, and a replaced element pinned at all four edges keeps its
   * intrinsic 1080 × 1920 rather than stretching to them.
   */
  video: { height: '100%', position: 'absolute', start: 0, top: 0, width: '100%' },
  centre: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  playDisc: {
    alignItems: 'center',
    borderRadius: 40,
    height: 80,
    justifyContent: 'center',
    paddingStart: 4,
    width: 80,
  },
  top: {
    gap: v3.space[10],
    left: 0,
    paddingHorizontal: v3.space[12],
    position: 'absolute',
    right: 0,
    top: 0,
  },
  track: {
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 2,
    height: 3,
    overflow: 'hidden',
  },
  fill: { height: 3 },
  topRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  pill: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: v3.space[6],
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[6],
  },
  pillText: { ...v3.type.callout, fontWeight: '700' },
  close: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  bottom: {
    alignSelf: 'center',
    bottom: 0,
    maxWidth: 480,
    paddingHorizontal: v3.space[20],
    position: 'absolute',
    width: '100%',
  },
}))
