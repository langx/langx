import { SettingsSectionPage } from '../../../src/components/settings/SettingsSectionPage'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'

export default function AboutSettingsScreen() {
  useScreenInteractive()
  return <SettingsSectionPage id="about" />
}
