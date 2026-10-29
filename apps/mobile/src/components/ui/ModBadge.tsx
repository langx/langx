import { useMemo } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Path, Rect } from 'react-native-svg'
import { useT } from '../../i18n'
import { modBadgeArt } from '../../lib/modBadge'
import { PRO_BADGE_ART_HEIGHT, proBadgeHeight, proBadgeWidth } from '../../lib/proBadge'
import { useTheme } from '../../lib/theme'

interface ModBadgeProps {
  /** The size of the text it stands beside, as `ProBadge` takes it. */
  fontSize: number
  /** What it stands on: the ground, or a partner's hue. */
  on?: 'ground' | 'hue'
  style?: StyleProp<ViewStyle>
}

/**
 * The MOD badge beside a moderator's name: PRO's pill, with a shield where
 * PRO has its star, so when somebody is both the two sit as one line of facts.
 *
 * Drawn, not set in a font, for the same reason PRO is — and because a chip
 * with text inside stood on that text's baseline in a row aligned on
 * `baseline`, a descender's depth below PRO. Its bottom edge is its baseline.
 *
 * Ink rather than a colour of its own: violet is the plan's, yellow is the
 * screen's committing action and blue is Echo, and a role is not a thing to
 * buy or press. On the ground it is the pill that inverts with the scheme; on
 * a hue the fixed ink, which reads on all six. The shield is Settings'
 * Moderation glyph. What a screen reader says is translated.
 */
export function ModBadge({ fontSize, on = 'ground', style }: ModBadgeProps) {
  const t = useT()
  const { v3 } = useTheme()
  const height = proBadgeHeight(fontSize)
  const art = useMemo(() => modBadgeArt(height), [height])

  const pill = on === 'hue' ? v3.colors.ink : v3.colors.pill
  const mark = on === 'hue' ? v3.colors.onSignal : v3.colors.pillText
  const width = proBadgeWidth(art, height)

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('profile.modBadge')}
      style={[{ height, width }, style]}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${art.width} ${PRO_BADGE_ART_HEIGHT}`}>
        <Rect x={1} y={1} width={art.width - 2} height={22} rx={11} fill={pill} />
        <Path
          d={art.shield}
          fill={mark}
          stroke={mark}
          strokeWidth={art.shieldRound}
          strokeLinejoin="round"
        />
        <Path
          d={art.letters}
          stroke={mark}
          strokeWidth={art.stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Path d={art.o} stroke={mark} strokeWidth={art.stroke} fill="none" />
      </Svg>
    </View>
  )
}
