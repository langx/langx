import { useSettingsModel } from '../../hooks/useSettingsModel'
import { useT } from '../../i18n'
import { goBackTo } from '../../lib/navigation'
import { settingsSection, type SettingsSectionId } from '../../lib/settingsRegistry'
import { Screen } from '../ui/Screen'
import { ScreenHeader } from '../ui/ScreenHeader'
import { SettingsRow } from './SettingsRow'

/**
 * One category of settings, on its own page: the header, then every row the
 * registry lists for it, in order. The six route files under
 * `app/(app)/settings/` are each one line of this.
 */
export function SettingsSectionPage({ id }: { id: SettingsSectionId }) {
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
