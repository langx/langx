import { useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { AppState, Linking, Platform, Text, View } from 'react-native'
import { Button } from '../../../src/components/ui/Button'
import { Callout, type CalloutTone } from '../../../src/components/ui/Callout'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { useT, type MessageKey } from '../../../src/i18n'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { enablePushOnThisDevice } from '../../../src/hooks/usePushRegistration'
import { readPushGuideStatus, type PushGuideStatus } from '../../../src/lib/pushPermission'
import { goBackTo } from '../../../src/lib/navigation'
import { makeStyles } from '../../../src/lib/theme'

/**
 * The one place that explains notification permission, and the sibling of
 * `settings/location.tsx` in every respect — including why it is a page.
 *
 * "You get no notifications" has four different answers and only one of them
 * is "allow it": the OS may never ask again, the switch in LangX may be off
 * while the phone is perfectly willing, and on the web there is no push to
 * arrange at all. A switch that springs back says none of that, and this
 * failure has already cost one person every notification for as long as they
 * have had the app — found by photographing an iOS Settings page, because the
 * app had nowhere to say it.
 */
const IOS_STEPS: readonly MessageKey[] = [
  'notifications.guide.iosStep1',
  'notifications.guide.iosStep2',
  'notifications.guide.iosStep3',
]

const ANDROID_STEPS: readonly MessageKey[] = [
  'notifications.guide.androidStep1',
  'notifications.guide.androidStep2',
  'notifications.guide.androidStep3',
  'notifications.guide.androidStep4',
]

export default function PushPermissionScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const params = useLocalSearchParams<{ from?: string }>()
  const [status, setStatus] = useState<PushGuideStatus | null>(null)

  const read = useCallback(() => {
    // `blocked` on a failed read, for `settings/location.tsx`'s reason: it is
    // the one state whose instructions are worth following whatever the truth
    // turns out to be, and a screen stuck at `null` renders as a bare header.
    readPushGuideStatus(Platform.OS).then(setStatus, () => setStatus('blocked'))
  }, [])

  /*
   * Re-read on every foreground. The path this screen exists for ends in the
   * Settings app, and a guide still saying "your device will not ask again"
   * when you come back from granting it looks broken at exactly the moment it
   * worked.
   */
  useEffect(() => {
    read()
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') read()
    })
    return () => subscription.remove()
  }, [read])

  const back = () => goBackTo('/(app)/settings/notifications', params.from)

  const header = <ScreenHeader title={t('notifications.guide.title')} onBack={back} />
  if (status === null) return <Screen>{header}</Screen>

  const ios = Platform.OS === 'ios'
  const copy: Record<
    PushGuideStatus,
    { tone: CalloutTone; icon: 'check-circle' | 'bell' | 'bell-off' | 'alert-triangle' | 'globe' }
  > = {
    granted: { tone: 'success', icon: 'check-circle' },
    askable: { tone: 'info', icon: 'bell' },
    blocked: { tone: 'warning', icon: 'alert-triangle' },
    silenced: { tone: 'warning', icon: 'bell-off' },
    web: { tone: 'info', icon: 'globe' },
  }
  const titleKey: Record<PushGuideStatus, MessageKey> = {
    granted: 'notifications.guide.grantedTitle',
    askable: 'notifications.guide.askableTitle',
    blocked: 'notifications.guide.blockedTitle',
    silenced: 'notifications.guide.silencedTitle',
    web: 'notifications.guide.webTitle',
  }
  const bodyKey: Record<PushGuideStatus, MessageKey> = {
    granted: 'notifications.guide.grantedBody',
    askable: 'notifications.guide.askableBody',
    blocked: 'notifications.guide.blockedBody',
    silenced: 'notifications.guide.silencedBody',
    web: 'notifications.guide.webBody',
  }

  return (
    <Screen scroll>
      {header}
      <View style={styles.column}>
        <Callout tone={copy[status].tone} title={t(titleKey[status])} icon={copy[status].icon}>
          <Text style={styles.body}>{t(bodyKey[status])}</Text>
        </Callout>

        {/* Only where there is a path to walk. `silenced` is one switch and one
            sentence, and `granted` has nothing to fix. */}
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
          // between this state and `blocked`. `enablePushOnThisDevice` rather
          // than the raw request: a grant that registers no token is a phone
          // the server still cannot address.
          <Button
            label={t('notifications.guide.allow')}
            onPress={async () => {
              await enablePushOnThisDevice()
              read()
            }}
          />
        ) : status === 'web' || status === 'silenced' /* Neither has anything for the
             Settings app to do: the web has no per-app screen at all (and
             `Linking.openSettings` does not exist in react-native-web), and a
             silenced phone is waiting on LangX's own switch, one screen up. */ ? null : (
          <Button
            label={t('notifications.guide.openSettings')}
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
  // A counter of our own rather than "1." inside each string, for the reason
  // `settings/location.tsx` gives: a number that is markup cannot be
  // translated away by mistake.
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
