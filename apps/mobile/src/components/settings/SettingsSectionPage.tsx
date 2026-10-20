import { useSettingsModel } from '../../hooks/useSettingsModel'
import { useV3Home } from '../../hooks/useV3Home'
import { useT } from '../../i18n'
import { goBackTo } from '../../lib/navigation'
import { settingsSection, type SettingsSectionId } from '../../lib/settingsRegistry'
import { Screen } from '../ui/Screen'
import { ScreenHeader } from '../ui/ScreenHeader'
import { SettingsRow } from './SettingsRow'
import { SettingsSectionPageV3 } from './v3/SettingsSectionPageV3'

/**
 * One category of settings, on its own page: the header, then every row the
 * registry lists for it, in order. The six route files under
 * `app/(app)/settings/` are each one line of this.
 */
export function SettingsSectionPage({ id }: { id: SettingsSectionId }) {
  // The redesign's page under `flags.v3Home`, read once per launch.
  return useV3Home() ? <SettingsSectionPageV3 id={id} /> : <CurrentSectionPage id={id} />
}

function CurrentSectionPage({ id }: { id: SettingsSectionId }) {
  const t = useT()
  const model = useSettingsModel()
  const section = settingsSection(id)

  return (
    <Screen scroll>
      <ScreenHeader title={t(section.titleKey)} onBack={() => goBackTo('/(app)/settings')} />
      {section.items.map((item, index) => (
        <SettingsRow
          key={item.id}
          id={item.id}
          model={model}
          last={index === section.items.length - 1}
        />
      ))}
    </Screen>
  )
}
