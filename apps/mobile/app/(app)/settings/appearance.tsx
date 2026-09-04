import { SettingsSectionPage } from '../../../src/components/settings/SettingsSectionPage'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'

export default function AppearanceSettingsScreen() {
  useScreenInteractive()
  return <SettingsSectionPage id="appearance" />
}
