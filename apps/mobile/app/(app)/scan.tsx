import Feather from '@expo/vector-icons/Feather'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { router } from 'expo-router'
import { useRef, useState } from 'react'
import { Linking, Platform, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button } from '../../src/components/ui/Button'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'
import { useT } from '../../src/i18n'
import { goBackTo } from '../../src/lib/navigation'
import { scanTarget } from '../../src/lib/scanTarget'
import { makeStyles, spacing } from '../../src/lib/theme'
import { showToast } from '../../src/lib/toast'

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
  const [permission, requestPermission] = useCameraPermissions()
  const [warned, setWarned] = useState<string | null>(null)
  // One scan per visit: the camera reports the same code many times a second.
  const handled = useRef(false)

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
    <View style={styles.stage}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={(result) => onScanned(result.data)}
      />
      <View style={[styles.overlay, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          onPress={() => goBackTo('/(app)/(tabs)/me')}
          hitSlop={12}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <Feather name="x" size={22} color="#ffffff" />
        </Pressable>
        <View style={styles.frame} />
        <Text style={styles.hint}>{t('scan.body')}</Text>
        <Button
          label={t('scan.typeInstead')}
          variant="secondary"
          onPress={() => router.replace('/(app)/link-device')}
          style={styles.typeInstead}
        />
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ radius, spacing }) => ({
  stage: { backgroundColor: '#000000', flex: 1 },
  camera: { ...{ position: 'absolute' as const }, bottom: 0, left: 0, right: 0, top: 0 },
  overlay: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  close: {
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  pressed: { opacity: 0.7 },
  /* The viewfinder: a square a code is comfortably framed in. Decorative
     only — the whole picture is scanned, not just the square. */
  frame: {
    borderColor: 'rgba(255,255,255,0.9)',
    borderRadius: radius.xl,
    borderWidth: 3,
    height: 240,
    width: 240,
  },
  hint: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 4,
  },
  typeInstead: { alignSelf: 'stretch' },
}))
