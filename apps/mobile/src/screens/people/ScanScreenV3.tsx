import Feather from '@expo/vector-icons/Feather'
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useFonts } from 'expo-font'
import { router } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Animated, Linking, Platform, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SettingsHeaderV3 } from '../../components/settings/v3/SettingsKitV3'
import { EmptyNoteV3 } from '../../components/ui/EmptyStateV3'
import { IconButton } from '../../components/ui/IconButton'
import { Screen } from '../../components/ui/Screen'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useT } from '../../i18n'
import { goBackTo } from '../../lib/navigation'
import { scanTarget } from '../../lib/scanTarget'
import { DISPLAY_FONT, makeStyles, useTheme } from '../../lib/theme'
import { showToast } from '../../lib/toast'

/*
 * Literal colours, on purpose, as in `scan.tsx`: a camera view is dark
 * whichever scheme the app is in, so tokens that flip with the scheme would
 * be wrong in one of them. These are `V-Scan`'s.
 */
const STAGE_BG = '#0b0c0e'
const ON_STAGE = '#ffffff'
const ON_STAGE_MUTED = 'rgba(255, 255, 255, 0.78)'
const ON_STAGE_EDGE = 'rgba(255, 255, 255, 0.55)'

/**
 * The camera, in the v3 look (`V-Scan`), behind `flags.v3Home`. What a scan
 * does is `scan.tsx`'s: a sign-in code lands on Devices with the code filled
 * in — a scan never approves anything — a profile or invite code lands on
 * that profile, anything else is a toast and the camera keeps looking, and
 * one scan per visit. The scan line blinks unless the person asked for less
 * motion. No scanner on the web.
 */
export function ScanScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const insets = useSafeAreaInsets()
  const reduceMotion = useReduceMotion()
  const [blackLoaded] = useFonts({ Nunito_900Black })
  const [permission, requestPermission] = useCameraPermissions()
  const [warned, setWarned] = useState<string | null>(null)
  const handled = useRef(false)
  const scanning = Platform.OS !== 'web' && permission?.granted === true

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
      <Screen ground={v3.colors.bg}>
        <SettingsHeaderV3 title={t('scan.title')} onBack={() => goBackTo('/(app)/(tabs)/me')} />
        <EmptyNoteV3 icon="camera-off" title={t('scan.title')} body={t('scan.webOnly')} />
      </Screen>
    )
  }

  if (!permission?.granted) {
    return (
      <Screen ground={v3.colors.bg}>
        <SettingsHeaderV3 title={t('scan.title')} onBack={() => goBackTo('/(app)/(tabs)/me')} />
        <EmptyNoteV3
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
        { paddingBottom: insets.bottom + v3.space[20], paddingTop: insets.top + v3.space[6] },
      ]}
    >
      <View style={styles.header}>
        <IconButton
          icon="x"
          color={ON_STAGE}
          accessibilityLabel={t('common.cancel')}
          onPress={() => goBackTo('/(app)/(tabs)/me')}
        />
        <Text
          accessibilityRole="header"
          style={[styles.title, !blackLoaded && styles.titleFallback]}
          numberOfLines={2}
        >
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
        <Feather name="type" size={v3.icon.md} color={ON_STAGE} />
        <Text style={styles.typeInsteadLabel}>{t('scan.typeInstead')}</Text>
      </Pressable>
    </View>
  )
}

const BRACKET = 46
const EDGE = 5

const useStyles = makeStyles(({ v3 }) => ({
  stage: { backgroundColor: STAGE_BG, flex: 1 },
  header: { gap: v3.space[2], paddingEnd: v3.space[16], paddingStart: v3.space[6] },
  pressed: { opacity: 0.6 },
  title: { ...v3.type.title, color: ON_STAGE, paddingStart: v3.space[10] },
  titleFallback: { fontFamily: DISPLAY_FONT },
  centre: {
    alignItems: 'center',
    flex: 1,
    gap: 28,
    justifyContent: 'center',
    paddingHorizontal: v3.space[24],
  },
  viewfinder: { borderRadius: 6, height: 280, overflow: 'hidden', width: 280 },
  camera: { bottom: 0, end: 0, position: 'absolute', start: 0, top: 0 },
  bracket: { borderColor: v3.colors.blue, height: BRACKET, position: 'absolute', width: BRACKET },
  bracketTopStart: {
    borderStartWidth: EDGE,
    borderTopStartRadius: 14,
    borderTopWidth: EDGE,
    start: 0,
    top: 0,
  },
  bracketTopEnd: {
    borderEndWidth: EDGE,
    borderTopEndRadius: 14,
    borderTopWidth: EDGE,
    end: 0,
    top: 0,
  },
  bracketBottomStart: {
    borderBottomStartRadius: 14,
    borderBottomWidth: EDGE,
    borderStartWidth: EDGE,
    bottom: 0,
    start: 0,
  },
  bracketBottomEnd: {
    borderBottomEndRadius: 14,
    borderBottomWidth: EDGE,
    borderEndWidth: EDGE,
    bottom: 0,
    end: 0,
  },
  scanLine: {
    backgroundColor: v3.colors.blue,
    borderRadius: v3.radius.pill,
    end: 20,
    height: 3,
    position: 'absolute',
    start: 20,
    top: 139,
  },
  hint: { ...v3.type.body, color: ON_STAGE_MUTED, maxWidth: 300, textAlign: 'center' },
  typeInstead: {
    alignItems: 'center',
    borderColor: ON_STAGE_EDGE,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    flexDirection: 'row',
    gap: v3.space[10],
    height: 56,
    justifyContent: 'center',
    marginHorizontal: v3.space[16],
  },
  typeInsteadLabel: { ...v3.type.button, color: ON_STAGE },
}))
