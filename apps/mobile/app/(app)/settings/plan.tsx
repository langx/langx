import { SettingsSectionPage } from '../../../src/components/settings/SettingsSectionPage'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'

export default function PlanSettingsScreen() {
  useScreenInteractive()
  return <SettingsSectionPage id="plan" />
}
