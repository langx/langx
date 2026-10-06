import Feather from '@expo/vector-icons/Feather'
import { useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { useEvent, useEventListener } from 'expo'
import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useVideoPlayer, VideoView } from 'expo-video'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  keys,
  openViewOnce,
  reportViewOnceScreenshot,
  type MessageDto,
  type ViewOnceOpenDto,
} from '../../src/api/queries'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'
import { useT } from '../../src/i18n'
import { errorCodeOf } from '../../src/lib/errors'
import { applyMessageUpdate, type MessagePageDto } from '../../src/lib/messageCache'
import { goBackTo } from '../../src/lib/navigation'
import { makeStyles, spacing } from '../../src/lib/theme'
import { showToast } from '../../src/lib/toast'
import { withoutViewOnceFallback } from '../../src/lib/viewOnce'

/* Literal colours: the viewer is black in both schemes, like `chat-camera.tsx`. */
const STAGE_BG = '#000000'
const ON_STAGE = '#ffffff'
const SCRIM = 'rgba(0, 0, 0, 0.35)'
const TRACK = 'rgba(255, 255, 255, 0.3)'
/** How long a clip may take to start before the viewer gives up on it. */
const STALL_MS = 15_000

/**
 * One open of a view-once photo or video.
 *
 * A screen of its own, not a `Modal` like `PhotoViewer`. On Android a modal
 * is a separate window, and `FLAG_SECURE` — what makes a screenshot come out
 * black — is set on the activity's window: a picture in a modal would be the
 * one thing on screen a screenshot could still take.
 *
 * The open is spent when this screen asks for the file, once per visit (a ref,
 * so a development double-mount does not spend two). Nothing is kept
 * afterwards: the image is drawn with no cache, the video is streamed, and the
 * address dies with the screen.
 */
export default function ViewOnceScreen() {
  useScreenInteractive()
  const t = useT()
  const styles = useStyles()
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()
  const params = useLocalSearchParams<{
    conversationId: string
    messageId: string
    senderId: string
  }>()
  const conversationId = params.conversationId ?? ''
  const messageId = params.messageId ?? ''
  const [media, setMedia] = useState<ViewOnceOpenDto['media'] | null>(null)
  const asked = useRef(false)
  const screenshotTold = useRef(false)

  useNoScreenCapture()

  function close(): void {
    goBackTo(`/(app)/chat/${conversationId}`)
  }

  /** The thread's copy of the message, so the bubble turns as this opens. */
  function remember(message: MessageDto): void {
    queryClient.setQueriesData<InfiniteData<MessagePageDto>>(
      { queryKey: keys.messages(conversationId) },
      (old) => applyMessageUpdate(old, withoutViewOnceFallback(message)) ?? old,
    )
  }

  useEffect(() => {
    if (asked.current || !conversationId || !messageId) return
    asked.current = true
    openViewOnce(conversationId, messageId)
      .then((result) => {
        remember(result.message)
        setMedia(result.media)
      })
      .catch((error: unknown) => {
        showToast(
          errorCodeOf(error) === 'VIEW_ONCE_GONE' ? t('viewOnce.gone') : t('viewOnce.openFailed'),
        )
        close()
      })
    // Once per visit, by design — see the ref.
  }, [conversationId, messageId])

  /*
   * The sender hears about a screenshot. Only once it is open: before that
   * there is nothing on screen to capture, and the server refuses it.
   * Android 13 and below cannot notice one without a gallery permission this
   * app does not take, so there the screenshot is only blocked.
   */
  useEffect(() => {
    if (!media || Platform.OS === 'web') return
    let subscription: { remove: () => void } | undefined
    void import('expo-screen-capture').then((ScreenCapture) => {
      subscription = ScreenCapture.addScreenshotListener(() => {
        if (screenshotTold.current) return
        screenshotTold.current = true
        void reportViewOnceScreenshot(conversationId, messageId)
          .then(remember)
          .catch(() => undefined)
      })
    })
    return () => subscription?.remove()
  }, [media])

  function report(): void {
    router.replace({
      pathname: '/(app)/report',
      params: { userId: params.senderId ?? '', conversationId, messageId },
    })
  }

  return (
    <View style={styles.stage}>
      <StatusBar style="light" hidden />
      {media === null ? (
        <View style={styles.centre}>
          <ActivityIndicator color={ON_STAGE} />
        </View>
      ) : media.contentType.startsWith('video/') ? (
        <OnceVideo
          url={media.url}
          onEnd={close}
          onFail={() => {
            // Not "try again": the open is spent, and there is nothing to retry.
            showToast(t('viewOnce.playFailed'))
            close()
          }}
          topInset={insets.top}
        />
      ) : (
        // A tap anywhere is done looking, as it is on Instagram.
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('viewOnce.close')}
          onPress={close}
          style={StyleSheet.absoluteFill}
        >
          <Image
            source={{ uri: media.url }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            cachePolicy="none"
          />
        </Pressable>
      )}
      <View style={[styles.topBar, { top: insets.top + spacing.lg }]} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('viewOnce.report')}
          onPress={report}
          hitSlop={10}
          style={({ pressed }) => [styles.roundIcon, pressed && styles.pressed]}
        >
          <Feather name="flag" size={18} color={ON_STAGE} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('viewOnce.close')}
          onPress={close}
          hitSlop={10}
          style={({ pressed }) => [styles.roundIcon, pressed && styles.pressed]}
        >
          <Feather name="x" size={22} color={ON_STAGE} />
        </Pressable>
      </View>
    </View>
  )
}

/**
 * Played once, start to end, then the screen closes — a replay is the
 * bubble's to offer, not the player's. No controls: scrubbing back would be
 * a replay by another name.
 */
function OnceVideo({
  url,
  onEnd,
  onFail,
  topInset,
}: {
  url: string
  onEnd: () => void
  /** The player gave up on the file — a codec the phone cannot decode, a dropped download. */
  onFail: () => void
  topInset: number
}) {
  const styles = useStyles()
  const t = useT()
  const [progress, setProgress] = useState(0)
  const player = useVideoPlayer(url, (instance) => {
    instance.loop = false
    instance.timeUpdateEventInterval = 0.2
    instance.play()
  })
  useEventListener(player, 'playToEnd', onEnd)
  /*
   * Said and closed rather than left on a play button that can never play:
   * the open is already spent, and a black screen reads as the app hanging.
   * Read as state rather than caught as an event, because the failure can
   * land before a listener is attached — an iPhone refuses a file whose sound
   * it cannot decode while the asset is still being inspected.
   */
  const { status } = useEvent(player, 'statusChange', { status: player.status })
  const failed = useRef(false)
  // The latest handler, so a re-render does not restart the stall timer below.
  const fail = useRef(onFail)
  fail.current = onFail
  useEffect(() => {
    if (status !== 'error' || failed.current) return
    failed.current = true
    fail.current()
  }, [status])
  /*
   * And a clip that never moves. An iPhone given a file whose sound it cannot
   * decode — AMR, which some Android encoder profiles choose — reports no
   * error status at all: the player says it is playing, AVKit draws its own
   * crossed-out play symbol, and the clock stays at zero. So this watches the
   * clock, not the flag. A phone gets a playable clip moving within moments
   * of the address arriving; one still at zero by now is not going to move.
   * Not on the web, where waiting for the viewer's tap is the normal state.
   */
  const { isPlaying: started } = useEvent(player, 'playingChange', { isPlaying: player.playing })
  useEffect(() => {
    if (Platform.OS === 'web' || progress > 0) return
    const timer = setTimeout(() => {
      if (failed.current) return
      failed.current = true
      fail.current()
    }, STALL_MS)
    return () => clearTimeout(timer)
  }, [progress])
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (player.duration > 0) setProgress(Math.min(1, currentTime / player.duration))
  })

  return (
    <>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls={false}
        allowsVideoFrameAnalysis={false}
        fullscreenOptions={{ enable: false }}
      />
      <View style={[styles.track, { top: topInset + 6 }]}>
        <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
      </View>
      {/*
        A browser will not start a clip with sound by itself: the tap that
        opened this screen was spent on the open, before the file arrived. So
        on the web a clip that has not started waits for one more tap, which
        also lets its sound through. A phone starts it at once.
      */}
      {!started && progress === 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('media.playVideo')}
          onPress={() => player.play()}
          style={styles.playCentre}
        >
          <View style={styles.playButton}>
            <Feather name="play" size={30} color={ON_STAGE} />
          </View>
        </Pressable>
      ) : null}
    </>
  )
}

/**
 * `usePreventScreenCapture`, made safe for the web — where the module has no
 * implementation and the hook's promise rejects with nobody to catch it.
 * Keyed, so the app's other uses (if it grows any) do not lift this one's.
 */
function useNoScreenCapture(): void {
  useEffect(() => {
    if (Platform.OS === 'web') return
    let lifted = false
    const module = import('expo-screen-capture')
    void module
      .then((ScreenCapture) => {
        if (!lifted) return ScreenCapture.preventScreenCaptureAsync('view-once')
      })
      .catch(() => undefined)
    return () => {
      lifted = true
      void module
        .then((ScreenCapture) => ScreenCapture.allowScreenCaptureAsync('view-once'))
        .catch(() => undefined)
    }
  }, [])
}

const useStyles = makeStyles(({ radius }) => ({
  stage: { backgroundColor: STAGE_BG, flex: 1 },
  centre: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: spacing.lg,
    position: 'absolute',
    right: spacing.lg,
  },
  roundIcon: {
    alignItems: 'center',
    backgroundColor: SCRIM,
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  pressed: { opacity: 0.6 },
  track: {
    backgroundColor: TRACK,
    borderRadius: 2,
    height: 3,
    left: spacing.lg,
    overflow: 'hidden',
    position: 'absolute',
    right: spacing.lg,
  },
  trackFill: { backgroundColor: ON_STAGE, height: 3 },
  // `flex` rather than `absoluteFill`: on the web the player's element keeps
  // the clip's own size inside an absolute box and runs off the screen.
  // `minHeight: 0` because the element is a bare `<video>`, not a View, so it
  // misses the zero minimum react-native-web gives its own boxes. A flex item's
  // default minimum is its content, so a portrait clip on a landscape screen
  // grew to the width times 16/9 and showed only its middle, looking zoomed.
  video: { flex: 1, minHeight: 0, width: '100%' },
  playCentre: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  playButton: {
    alignItems: 'center',
    backgroundColor: SCRIM,
    borderRadius: radius.pill,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
}))
