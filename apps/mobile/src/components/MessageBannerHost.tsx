import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Animated, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useT, type MessageKey } from '../i18n'
import { useProfileCache } from '../hooks/useProfileCache'
import {
  dismissMessageBanner,
  MESSAGE_BANNER_DURATION_MS,
  subscribeToMessageBanner,
  type MessageBanner,
} from '../lib/inAppNotifications'
import { makeStyles, useTheme } from '../lib/theme'
import { Avatar } from './ui/Avatar'

/**
 * "Somebody wrote to you", while the app is open.
 *
 * Mounted at the root beside `ToastHost` and after the navigator, so it paints
 * over whichever screen is up and survives that screen going away. A plain
 * positioned view rather than a `Modal`, for the same reason the toast is one:
 * a `Modal` takes the touches of the whole screen, and this must not stop
 * anybody carrying on with what they were doing.
 *
 * Inside `QueryClientProvider`, because the avatar and the name come from the
 * same profile cache the chat list reads — a banner that fetched its own would
 * flash an empty circle for a person already on screen behind it.
 */
export function MessageBannerHost() {
  const { spacing } = useTheme()
  const styles = useStyles()
  const t = useT()
  const insets = useSafeAreaInsets()

  const [banner, setBanner] = useState<MessageBanner | null>(null)
  const slide = useRef(new Animated.Value(0)).current

  useEffect(() => subscribeToMessageBanner(setBanner), [])

  const profiles = useProfileCache(banner ? [banner.senderId] : [])
  const sender = banner ? profiles[banner.senderId] : undefined

  /**
   * The slide is decoration; being visible is not. The card is drawn at full
   * opacity from its first frame and only its position animates, so a banner
   * whose animation never runs is a banner sitting 16pt too high, not a banner
   * nobody saw.
   *
   * That is what the first iOS device test produced: the socket handler ran,
   * `showMessageBanner` was called, the host mounted — and nothing was on
   * screen. The first banner of a launch is the one case where the view mounts
   * with its `Animated.Value` still JS-side and the native driver connects to
   * an already-mounted view from a passive effect; every later banner mounts
   * against a value that is native already. A fade from 0 gates the whole
   * card on that first connect succeeding, and it did not. `ToastHost` still
   * fades in the same way on purpose: it is left as the control until the
   * same test has been run on it.
   */
  useEffect(() => {
    if (!banner) return
    slide.setValue(0)
    Animated.timing(slide, { toValue: 1, duration: 180, useNativeDriver: true }).start()
    // Keyed on the id, so a message replacing another restarts the clock for
    // itself rather than inheriting what was left of the first one's.
    const timer = setTimeout(() => dismissMessageBanner(banner.id), MESSAGE_BANNER_DURATION_MS)
    return () => clearTimeout(timer)
  }, [banner, slide])

  if (!banner) return null

  const name = sender?.displayName ?? sender?.handle ?? t('chats.someone')
  const preview =
    banner.preview === 'text' ? banner.body : t(`chats.preview.${banner.preview}` as MessageKey)

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.layer,
        {
          paddingTop: insets.top + spacing.sm,
          transform: [
            { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) },
          ],
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('chats.bannerA11y', { name })}
        onPress={() => {
          dismissMessageBanner(banner.id)
          router.push(`/(app)/chat/${banner.conversationId}`)
        }}
        style={styles.card}
      >
        <Avatar url={sender?.avatarUrl} name={name} seed={banner.senderId} size={36} />
        <View style={styles.text}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.preview} numberOfLines={1}>
            {preview}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  // Top, like the toast, and for the same reason: the bottom of every
  // signed-in screen is where the tab bar is, and this one is tappable.
  layer: {
    alignItems: 'center',
    left: 0,
    paddingHorizontal: spacing.lg,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  // A surface card rather than the toast's solid yellow: this is somebody
  // else's message, not the app reporting on itself, and it carries a face.
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    maxWidth: 420,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    width: '100%',
  },
  text: { flex: 1 },
  name: { ...font.body, color: colors.text, fontWeight: '600' },
  preview: { ...font.caption, color: colors.textMuted },
}))
