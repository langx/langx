import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useTheme } from '../lib/theme'
import { useT } from '../i18n'

/**
 * The tick beside @langx and @copilot.
 *
 * Drawn wherever a display name is, because that is what it qualifies: a
 * message from "LangX" in a chat list is worth exactly as much as knowing it
 * really is LangX. The server decides who gets one — `PublicProfile.official`
 * — and nothing here compares a handle.
 *
 * It carries a label rather than being decorative: to a screen reader, an
 * unlabelled tick beside a name is either silence or "check mark", and neither
 * says what it means.
 */
export function OfficialMark({ size = 16 }: { size?: number }) {
  const { colors } = useTheme()
  const t = useT()
  return (
    <MaterialCommunityIcons
      name="check-decagram"
      size={size}
      color={colors.official}
      accessibilityLabel={t('profile.official')}
    />
  )
}
