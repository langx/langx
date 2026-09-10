import * as Location from 'expo-location'
import { useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { AppState, Linking, Platform, Text, View } from 'react-native'
import { Button } from '../../../src/components/ui/Button'
import { Callout, type CalloutTone } from '../../../src/components/ui/Callout'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { useT, type MessageKey } from '../../../src/i18n'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import {
  readLocationGuideStatus,
  type LocationGuideStatus,
} from '../../../src/lib/locationPermission'
import { goBackTo } from '../../../src/lib/navigation'
import { makeStyles } from '../../../src/lib/theme'

/**
 * The one place that explains location permission, and the only screen in the
 * app allowed to.
 *
 * Three screens ask for location and each used to answer a refusal with its
 * own alert, which meant three copies of an instruction that differs by
 * platform, by whether the OS will ask again, and by whether the device switch
 * is on at all. Discover now shows the reason and links here; the alerts do
 * the same. A page rather than a dialog for the reason `delete-account.tsx`
 * gives: `AlertHost` draws buttons and a paragraph, and this is a numbered
 * list with a state that changes while you are looking at it.
 */
const IOS_STEPS: readonly MessageKey[] = [
  'location.guide.iosStep1',
  'location.guide.iosStep2',
  'location.guide.iosStep3',
]

const ANDROID_STEPS: readonly MessageKey[] = [
  'location.guide.androidStep1',
  'location.guide.androidStep2',
  'location.guide.androidStep3',
  'location.guide.androidStep4',
]

export default function LocationPermissionScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const params = useLocalSearchParams<{ from?: string }>()
  const [status, setStatus] = useState<LocationGuideStatus | null>(null)

  const read = useCallback(() => {
    void readLocationGuideStatus().then(setStatus)
  }, [])

  /*
   * Re-read on every foreground, the same `AppState` listener and for the same
   * reason as `useLocationRefresh`: there is no background permission and
   * nothing else to hear the change. The one path this screen exists for ends
   * in the Settings app, and a guide still saying "your device will not ask
   * again" when you come back from granting it looks broken at precisely the
   * moment it worked.
   */
  useEffect(() => {
    read()
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') read()
    })
    return () => subscription.remove()
  }, [read])

  const back = () => goBackTo('/(app)/settings/privacy', params.from)

  const header = <ScreenHeader title={t('location.guide.title')} onBack={back} />
  // Nothing at all until the first read comes back. It is one synchronous-ish
  // tick, and a placeholder state would be a fourth thing to translate.
  if (status === null) return <Screen>{header}</Screen>

  const ios = Platform.OS === 'ios'
  const copy: Record<
    LocationGuideStatus,
    { tone: CalloutTone; icon: 'check-circle' | 'map-pin' | 'alert-triangle' | 'globe' }
  > = {
    granted: { tone: 'success', icon: 'check-circle' },
    askable: { tone: 'info', icon: 'map-pin' },
    blocked: { tone: 'warning', icon: 'alert-triangle' },
    servicesOff: { tone: 'warning', icon: 'alert-triangle' },
    web: { tone: 'info', icon: 'globe' },
  }
  const bodyKey: Record<LocationGuideStatus, MessageKey> = {
    granted: 'location.guide.grantedBody',
    askable: 'location.guide.askableBody',
    blocked: 'location.guide.blockedBody',
    servicesOff: ios
      ? 'location.guide.servicesOffBodyIos'
      : 'location.guide.servicesOffBodyAndroid',
    web: 'location.guide.webBody',
  }
  const titleKey: Record<LocationGuideStatus, MessageKey> = {
    granted: 'location.guide.grantedTitle',
    askable: 'location.guide.askableTitle',
    blocked: 'location.guide.blockedTitle',
    servicesOff: 'location.guide.servicesOffTitle',
    web: 'location.guide.webTitle',
  }

  return (
    <Screen scroll>
      {header}
      <View style={styles.column}>
        <Callout tone={copy[status].tone} title={t(titleKey[status])} icon={copy[status].icon}>
          <Text style={styles.body}>{t(bodyKey[status])}</Text>
        </Callout>

        {/* Only where there is a path to walk. `servicesOff` is one switch and
            one sentence, and `granted` has nothing to fix. */}
        {status === 'blocked' ? (
          <View style={styles.steps}>
            {(ios ? IOS_STEPS : ANDROID_STEPS).map((key, index) => (
              <View key={key} style={styles.step}>
                <Text style={styles.stepNumber}>{index + 1}</Text>
                <Text style={styles.stepText}>{t(key)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {status === 'askable' ? (
          // The dialog, from inside the app, which is the whole difference
          // between this state and `blocked`. `captureLocation` is deliberately
          // not used: it would go on to take a fix nobody asked for.
          <Button
            label={t('location.guide.allow')}
            onPress={async () => {
              await Location.requestForegroundPermissionsAsync()
              read()
            }}
          />
        ) : status === 'web' /* No button: `Linking.openSettings` does not exist in
             react-native-web — calling it there is the `TypeError` this screen
             was written to stop — and a browser has no per-app screen for it
             to open anyway. */ ? null : (
          <Button
            label={t('location.openSettings')}
            variant={status === 'granted' ? 'neutral' : 'primary'}
            onPress={() => void Linking.openSettings()}
          />
        )}
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  column: { gap: spacing.xl, paddingTop: spacing.md },
  body: { ...font.body, color: colors.text, lineHeight: 21 },
  steps: { gap: spacing.lg },
  step: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md },
  // A counter of our own rather than "1." inside each string: eight
  // translators should not each be deciding what a numbered list looks like,
  // and a number that is markup cannot be translated away by mistake.
  stepNumber: {
    ...font.label,
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    color: colors.textMuted,
    height: 24,
    lineHeight: 24,
    textAlign: 'center',
    width: 24,
  },
  stepText: { ...font.body, color: colors.text, flex: 1, lineHeight: 24 },
}))
