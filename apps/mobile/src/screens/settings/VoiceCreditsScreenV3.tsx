import { attributedVoices, getLanguage } from '@langx/shared'
import { Text } from 'react-native'
import {
  SettingsGroupV3,
  SettingsItemV3,
  SettingsScreenV3,
} from '../../components/settings/v3/SettingsKitV3'
import { SettingsLeadV3 } from '../../components/settings/v3/SettingsFormV3'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useT } from '../../i18n'
import { openExternal } from '../../lib/openExternal'
import { makeStyles, PARTNER_HUES } from '../../lib/theme'

/**
 * Who recorded the voices that read messages aloud, in the redesign's look
 * (`V-SetVoices`), behind `flags.v3Home`. Built from `attributedVoices()` as
 * `settings/voices.tsx` is, and for its reason: an obligation of the CC-BY
 * licences, credited by having been added. The rows stay untranslated — a
 * name, a licence identifier, a dataset's address.
 */
export function VoiceCreditsScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const credits = attributedVoices()

  return (
    <SettingsScreenV3 title={t('settings.voiceCredits')} back="/(app)/settings/about">
      <SettingsLeadV3>{t('settings.voiceCreditsBody')}</SettingsLeadV3>
      <SettingsGroupV3>
        {credits.map((voice, index) => {
          // `attribution` is "<voice> (<locale>), <dataset url>".
          const source = voice.attribution?.split(', ').pop() ?? ''
          const language = getLanguage(voice.lang)
          return (
            <SettingsItemV3
              key={voice.id}
              icon="mic"
              // Cycled, not picked by meaning: the squares only tell the rows apart.
              hue={PARTNER_HUES[index % PARTNER_HUES.length]}
              title={language?.name ?? voice.lang}
              subtitle={`${voice.id} · ${voice.license}`}
              external
              onPress={() => void openExternal(source)}
            />
          )
        })}
      </SettingsGroupV3>
      <Text style={styles.footer}>{t('settings.voiceCreditsEngines')}</Text>
    </SettingsScreenV3>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  footer: { ...v3.type.caption, color: v3.colors.muted, paddingHorizontal: v3.space[4] },
}))
