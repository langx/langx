import { MOD_BADGE } from '@langx/shared'
import { Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useT } from '../../i18n'
import { proBadgeHeight } from '../../lib/proBadge'
import { useTheme } from '../../lib/theme'

interface ModBadgeProps {
  /** The size of the text it stands beside, as `ProBadge` takes it. */
  fontSize: number
  /** What it stands on: the ground, or a partner's hue. */
  on?: 'ground' | 'hue'
  style?: StyleProp<ViewStyle>
}

/**
 * The MOD chip beside a moderator's name, PRO's height so the two sit as one
 * line of facts when somebody is both.
 *
 * Ink rather than a colour of its own: violet is the plan's, yellow is the
 * screen's committing action and blue is Echo, and a role is not a thing to
 * buy or press. On the ground it is the pill that inverts with the scheme; on
 * a hue the fixed ink, which reads on all six. The word is the same in every
 * language, as PRO is; what a screen reader says is translated.
 */
export function ModBadge({ fontSize, on = 'ground', style }: ModBadgeProps) {
  const t = useT()
  const { v3 } = useTheme()
  const height = proBadgeHeight(fontSize)

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('profile.modBadge')}
      style={[
        {
          height,
          paddingHorizontal: Math.round(height * 0.42),
          borderRadius: height / 2,
          justifyContent: 'center',
          backgroundColor: on === 'hue' ? v3.colors.ink : v3.colors.pill,
        },
        style,
      ]}
    >
      <Text
        style={{
          color: on === 'hue' ? v3.colors.onSignal : v3.colors.pillText,
          fontSize: Math.round(height * 0.56),
          fontWeight: '800',
          letterSpacing: 0.6,
        }}
      >
        {MOD_BADGE}
      </Text>
    </View>
  )
}
