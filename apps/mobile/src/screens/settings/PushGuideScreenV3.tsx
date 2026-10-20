import { useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { AppState, Linking, Platform } from 'react-native'
import {
  SettingsFormScreenV3,
  SettingsStateV3,
  SettingsStepsV3,
} from '../../components/settings/v3/SettingsFormV3'
import type { Glyph } from '../../components/settings/v3/SettingsKitV3'
import { Button } from '../../components/ui/Button'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { enablePushOnThisDevice } from '../../hooks/usePushRegistration'
import { useT, type MessageKey } from '../../i18n'
import { goBackTo } from '../../lib/navigation'
import { readPushGuideStatus, type PushGuideStatus } from '../../lib/pushPermission'
import type { PartnerHue } from '../../lib/theme'

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

/** Today's callout tones as hues: success mint, info sky, warning tangerine. */
const LOOK: Record<PushGuideStatus, { hue: PartnerHue; icon: Glyph }> = {
  granted: { hue: 'mint', icon: 'check-circle' },
  askable: { hue: 'sky', icon: 'bell' },
  blocked: { hue: 'tangerine', icon: 'alert-triangle' },
  silenced: { hue: 'tangerine', icon: 'bell-off' },
  web: { hue: 'sky', icon: 'globe' },
}

/**
 * The notification permission guide in the redesign's look (`V-SetPush`),
 * behind `flags.v3Home`. The states, the re-read on every foreground, the
 * steps and which button each state gets are `settings/push.tsx`'s.
 */
export function PushGuideScreenV3() {
  useScreenInteractive()
  const t = useT()
  const params = useLocalSearchParams<{ from?: string }>()
  const [status, setStatus] = useState<PushGuideStatus | null>(null)

  const read = useCallback(() => {
    // `blocked` on a failed read: see `settings/push.tsx`.
    readPushGuideStatus(Platform.OS).then(setStatus, () => setStatus('blocked'))
  }, [])

  useEffect(() => {
    read()
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') read()
    })
    return () => subscription.remove()
  }, [read])

  const back = () => goBackTo('/(app)/settings/notifications', params.from)
  const title = t('notifications.guide.title')
  if (status === null) return <SettingsFormScreenV3 title={title} onBack={back} />

  const ios = Platform.OS === 'ios'
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
    <SettingsFormScreenV3
      title={title}
      onBack={back}
      footer={
        status === 'askable' ? (
          // `enablePushOnThisDevice` rather than the raw request: a grant that
          // registers no token is a phone the server still cannot address.
          <Button
            label={t('notifications.guide.allow')}
            icon="bell"
            onPress={async () => {
              await enablePushOnThisDevice()
              read()
            }}
          />
        ) : status === 'web' || status === 'silenced' ? null : (
          <Button
            label={t('notifications.guide.openSettings')}
            icon="settings"
            variant={status === 'granted' ? 'secondary' : 'blue'}
            onPress={() => void Linking.openSettings()}
          />
        )
      }
    >
      <SettingsStateV3
        hue={LOOK[status].hue}
        icon={LOOK[status].icon}
        title={t(titleKey[status])}
        body={t(bodyKey[status])}
      />
      {status === 'blocked' ? (
        <SettingsStepsV3 steps={(ios ? IOS_STEPS : ANDROID_STEPS).map((key) => t(key))} />
      ) : null}
    </SettingsFormScreenV3>
  )
}
