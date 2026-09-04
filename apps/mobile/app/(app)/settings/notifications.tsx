import { SettingsSectionPage } from '../../../src/components/settings/SettingsSectionPage'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'

export default function NotificationsSettingsScreen() {
  useScreenInteractive()
  return <SettingsSectionPage id="notifications" />
}
