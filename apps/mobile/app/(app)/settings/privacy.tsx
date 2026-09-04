import { SettingsSectionPage } from '../../../src/components/settings/SettingsSectionPage'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'

export default function PrivacySettingsScreen() {
  useScreenInteractive()
  return <SettingsSectionPage id="privacy" />
}
