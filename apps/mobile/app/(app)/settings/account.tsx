import { SettingsSectionPage } from '../../../src/components/settings/SettingsSectionPage'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'

export default function AccountSettingsScreen() {
  useScreenInteractive()
  return <SettingsSectionPage id="account" />
}
