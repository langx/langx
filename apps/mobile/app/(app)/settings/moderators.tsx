import { Text } from 'react-native'
import { useModerators } from '../../../src/api/queries'
import {
  SettingsGroupV3,
  SettingsItemV3,
  SettingsScreenV3,
} from '../../../src/components/settings/v3/SettingsKitV3'
import { SettingsLeadV3 } from '../../../src/components/settings/v3/SettingsFormV3'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { useT } from '../../../src/i18n'
import { openProfile } from '../../../src/lib/navigation'
import { makeStyles, PARTNER_HUES } from '../../../src/lib/theme'

/**
 * Who moderates, for everybody. A MOD chip means something only if anybody
 * can check it against a list we publish, so this is that list: a name and a
 * profile, nothing about what they decided.
 */
export default function ModeratorsScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const moderators = useModerators()
  const items = moderators.data?.items ?? []

  return (
    <SettingsScreenV3 title={t('settings.moderators')} back="/(app)/settings/about">
      <SettingsLeadV3>{t('settings.moderatorsBody')}</SettingsLeadV3>
      {moderators.isPending ? (
        <Skeleton height={64} />
      ) : items.length === 0 ? (
        <Text style={styles.empty}>{t('settings.moderatorsEmpty')}</Text>
      ) : (
        <SettingsGroupV3>
          {items.map((mod, index) => (
            <SettingsItemV3
              key={mod.userId}
              icon="shield"
              hue={PARTNER_HUES[index % PARTNER_HUES.length]}
              title={mod.displayName}
              subtitle={mod.handle ? `@${mod.handle}` : undefined}
              onPress={
                mod.handle
                  ? () => openProfile(mod.handle ?? '', '/(app)/settings/moderators')
                  : undefined
              }
            />
          ))}
        </SettingsGroupV3>
      )}
    </SettingsScreenV3>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  empty: { ...v3.type.caption, color: v3.colors.muted, paddingHorizontal: v3.space[4] },
}))
