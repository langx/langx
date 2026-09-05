import { SettingsSectionPage } from '../../../src/components/settings/SettingsSectionPage'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'

export default function ShareSettingsScreen() {
  useScreenInteractive()
  return <SettingsSectionPage id="share" />
}
