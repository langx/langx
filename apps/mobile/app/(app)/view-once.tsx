import Feather from '@expo/vector-icons/Feather'
import { useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { useEventListener } from 'expo'
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
        <OnceVideo url={media.url} onEnd={close} topInset={insets.top} />
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
function OnceVideo({ url, onEnd, topInset }: { url: string; onEnd: () => void; topInset: number }) {
  const styles = useStyles()
  const [progress, setProgress] = useState(0)
  const player = useVideoPlayer(url, (instance) => {
    instance.loop = false
    instance.timeUpdateEventInterval = 0.2
    instance.play()
  })
  useEventListener(player, 'playToEnd', onEnd)
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (player.duration > 0) setProgress(Math.min(1, currentTime / player.duration))
  })

  return (
    <>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls={false}
        allowsVideoFrameAnalysis={false}
        fullscreenOptions={{ enable: false }}
      />
      <View style={[styles.track, { top: topInset + 6 }]}>
        <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
      </View>
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
}))
