import * as Location from 'expo-location'
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
import { useT, type MessageKey } from '../../i18n'
import { readLocationGuideStatus, type LocationGuideStatus } from '../../lib/locationPermission'
import { goBackTo } from '../../lib/navigation'
import type { PartnerHue } from '../../lib/theme'

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

/** Today's callout tones as hues: success mint, info sky, warning tangerine. */
const LOOK: Record<LocationGuideStatus, { hue: PartnerHue; icon: Glyph }> = {
  granted: { hue: 'mint', icon: 'check-circle' },
  askable: { hue: 'sky', icon: 'map-pin' },
  blocked: { hue: 'tangerine', icon: 'alert-triangle' },
  servicesOff: { hue: 'tangerine', icon: 'alert-triangle' },
  web: { hue: 'sky', icon: 'globe' },
}

/**
 * The location permission guide in the redesign's look (`V-SetLocation`),
 * behind `flags.v3Home`. The states, the re-read on every foreground, the
 * steps and which button each state gets are `settings/location.tsx`'s.
 */
export function LocationGuideScreenV3() {
  useScreenInteractive()
  const t = useT()
  const params = useLocalSearchParams<{ from?: string }>()
  const [status, setStatus] = useState<LocationGuideStatus | null>(null)

  const read = useCallback(() => {
    // `blocked` on a failed read: see `settings/location.tsx`.
    readLocationGuideStatus(Platform.OS).then(setStatus, () => setStatus('blocked'))
  }, [])

  useEffect(() => {
    read()
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') read()
    })
    return () => subscription.remove()
  }, [read])

  const back = () => goBackTo('/(app)/settings/privacy', params.from)
  const title = t('location.guide.title')
  if (status === null) return <SettingsFormScreenV3 title={title} onBack={back} />

  const ios = Platform.OS === 'ios'
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
    <SettingsFormScreenV3
      title={title}
      onBack={back}
      footer={
        status === 'askable' ? (
          // The dialog, from inside the app; no fix is taken (`captureLocation` is not used).
          <Button
            label={t('location.guide.allow')}
            icon="map-pin"
            onPress={async () => {
              await Location.requestForegroundPermissionsAsync()
              read()
            }}
          />
        ) : status === 'web' /* `Linking.openSettings` does not exist on the web. */ ? null : (
          <Button
            label={t('location.openSettings')}
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
