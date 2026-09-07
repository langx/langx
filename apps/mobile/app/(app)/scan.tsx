import Feather from '@expo/vector-icons/Feather'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Animated, Linking, Platform, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { useReduceMotion } from '../../src/hooks/useReduceMotion'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'
import { useT } from '../../src/i18n'
import { goBackTo } from '../../src/lib/navigation'
import { scanTarget } from '../../src/lib/scanTarget'
import { makeStyles, spacing } from '../../src/lib/theme'
import { showToast } from '../../src/lib/toast'

/*
 * Literal colours, on purpose. A camera view is dark whichever scheme the app
 * is in, so the palette's `bg` and `text` — which flip with the scheme — would
 * be wrong in one of them. These are the prototype's own values for the one
 * screen that never flips.
 */
const STAGE_BG = '#0b0c0e'
const ON_STAGE = '#ffffff'
const ON_STAGE_MUTED = 'rgba(255, 255, 255, 0.7)'
const ON_STAGE_BORDER = 'rgba(255, 255, 255, 0.25)'

/**
 * The camera, pointed at one of the two codes this app draws.
 *
 * A sign-in QR on a computer screen lands on the approve screen with the code
 * filled in — approve or deny stays that screen's question, because a scan is
 * not consent. A profile or invite QR lands on that profile. Anything else
 * is a toast and the camera keeps looking.
 *
 * Native only. The web build has no scanner and does not want one: the
 * sign-in QR is *shown* there, and a browser scanning a profile QR is not a
 * thing anybody does.
 */
export default function ScanScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const insets = useSafeAreaInsets()
  const reduceMotion = useReduceMotion()
  const [permission, requestPermission] = useCameraPermissions()
  const [warned, setWarned] = useState<string | null>(null)
  // One scan per visit: the camera reports the same code many times a second.
  const handled = useRef(false)
  const scanning = Platform.OS !== 'web' && permission?.granted === true

  // The scan line's blink — `Animated`, as `welcome.tsx` does its few frames.
  const blink = useRef(new Animated.Value(0.3)).current
  useEffect(() => {
    if (!scanning || reduceMotion) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 1, duration: 640, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 0.3, duration: 640, useNativeDriver: true }),
        Animated.delay(320),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [blink, reduceMotion, scanning])

  function onScanned(data: string): void {
    if (handled.current) return
    const target = scanTarget(data)
    if (!target) {
      if (warned !== data) {
        setWarned(data)
        showToast(t('scan.unknown'))
      }
      return
    }
    handled.current = true
    if (target.kind === 'device') {
      router.replace({ pathname: '/(app)/link-device', params: { user_code: target.code } })
    } else {
      router.replace(`/(app)/profile/${target.handle}`)
    }
  }

  if (Platform.OS === 'web') {
    return (
      <Screen>
        <ScreenHeader title={t('scan.title')} onBack={() => goBackTo('/(app)/(tabs)/me')} />
        <EmptyState icon="camera-off" title={t('scan.title')} body={t('scan.webOnly')} />
      </Screen>
    )
  }

  if (!permission?.granted) {
    return (
      <Screen>
        <ScreenHeader title={t('scan.title')} onBack={() => goBackTo('/(app)/(tabs)/me')} />
        <EmptyState
          icon="camera"
          title={t('scan.permissionTitle')}
          body={t('scan.permissionBody')}
          actionLabel={permission?.canAskAgain === false ? t('scan.openSettings') : t('scan.allow')}
          onAction={() => {
            if (permission?.canAskAgain === false) void Linking.openSettings()
            else void requestPermission()
          }}
        />
      </Screen>
    )
  }

  return (
    <View
      style={[
        styles.stage,
        { paddingBottom: insets.bottom + spacing.xxl, paddingTop: insets.top + 6 },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          onPress={() => goBackTo('/(app)/(tabs)/me')}
          hitSlop={12}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <Feather name="x" size={22} color={ON_STAGE} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {t('scan.title')}
        </Text>
      </View>

      <View style={styles.centre}>
        {/* The brackets are decoration: the whole picture is scanned, not just the square. */}
        <View style={styles.viewfinder}>
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={(result) => onScanned(result.data)}
          />
          <View style={[styles.bracket, styles.bracketTopStart]} />
          <View style={[styles.bracket, styles.bracketTopEnd]} />
          <View style={[styles.bracket, styles.bracketBottomStart]} />
          <View style={[styles.bracket, styles.bracketBottomEnd]} />
          <Animated.View style={[styles.scanLine, { opacity: blink }]} />
        </View>
        <Text style={styles.hint}>{t('scan.body')}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.replace('/(app)/link-device')}
        style={({ pressed }) => [styles.typeInstead, pressed && styles.pressed]}
      >
        <Text style={styles.typeInsteadLabel}>{t('scan.typeInstead')}</Text>
      </Pressable>
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, radius }) => ({
  stage: { backgroundColor: STAGE_BG, flex: 1 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  close: { alignItems: 'center', height: 34, justifyContent: 'center', width: 34 },
  pressed: { opacity: 0.6 },
  title: { ...font.heading, color: ON_STAGE, flex: 1 },
  centre: { alignItems: 'center', flex: 1, gap: 28, justifyContent: 'center', padding: 24 },
  viewfinder: { height: 260, overflow: 'hidden', width: 260 },
  camera: { bottom: 0, end: 0, position: 'absolute', start: 0, top: 0 },
  bracket: { borderColor: colors.primary, height: 40, position: 'absolute', width: 40 },
  bracketTopStart: {
    borderStartWidth: 4,
    borderTopStartRadius: radius.md,
    borderTopWidth: 4,
    start: 0,
    top: 0,
  },
  bracketTopEnd: {
    borderEndWidth: 4,
    borderTopEndRadius: radius.md,
    borderTopWidth: 4,
    end: 0,
    top: 0,
  },
  bracketBottomStart: {
    borderBottomStartRadius: radius.md,
    borderBottomWidth: 4,
    borderStartWidth: 4,
    bottom: 0,
    start: 0,
  },
  bracketBottomEnd: {
    borderBottomEndRadius: radius.md,
    borderBottomWidth: 4,
    borderEndWidth: 4,
    bottom: 0,
    end: 0,
  },
  scanLine: {
    backgroundColor: colors.primary,
    end: 20,
    height: 2,
    position: 'absolute',
    start: 20,
    top: 129,
  },
  hint: { color: ON_STAGE_MUTED, fontSize: 15, lineHeight: 22, maxWidth: 280, textAlign: 'center' },
  typeInstead: {
    alignItems: 'center',
    borderColor: ON_STAGE_BORDER,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    marginHorizontal: 24,
  },
  typeInsteadLabel: { ...font.heading, color: ON_STAGE, fontSize: 15 },
}))
