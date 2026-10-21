import { Redirect } from 'expo-router'
import { useV3Home } from '../../../src/hooks/useV3Home'
import { AppIconScreenV3 } from '../../../src/screens/settings/AppIconScreenV3'

/**
 * The app-icon picker as a page of its own, which only the redesign has
 * (`V-AppIcons`). With `flags.v3Home` off the picker is still the row of tiles
 * on the Appearance page, so a link that lands here goes there instead.
 */
export default function AppIconRoute() {
  return useV3Home() ? <AppIconScreenV3 /> : <Redirect href="/(app)/settings/appearance" />
}
