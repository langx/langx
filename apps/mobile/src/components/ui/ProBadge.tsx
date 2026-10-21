import { TIER_BADGES } from '@langx/shared'
import { useMemo } from 'react'
import { View, type StyleProp, type ViewStyle } from 'react-native'
import Svg, { Path, Rect } from 'react-native-svg'
import { useT } from '../../i18n'
import {
  PRO_BADGE_ART_HEIGHT,
  proBadgeArt,
  proBadgeHeight,
  proBadgeWidth,
} from '../../lib/proBadge'
import { useTheme } from '../../lib/theme'

interface ProBadgeProps {
  /**
   * The size of the text it stands beside. The badge is sized from it — a
   * little over that text's cap height — so beside a profile's name it is
   * the name's size, and beside a label it is a label's.
   */
  fontSize: number
  /**
   * What it stands on: the ground, or a partner's hue. On a hue the tablet is
   * ink in both schemes, the way everything drawn on a hue is.
   */
  on?: 'ground' | 'hue'
  style?: StyleProp<ViewStyle>
}

/**
 * v3's PRO badge: an ink tablet with PRO drawn into it, set in a name's line
 * the way a verified tick is.
 *
 * A word rather than a shape, so it cannot be read as the official account's
 * seal or a badge patch; flat ink with no yellow, so it does not spend the
 * screen's one committing colour on a status. Its bottom edge is its
 * baseline: in a row aligned on `baseline` it stands on the text's baseline
 * with its top at the capitals, and drops to the next line with the rest of
 * the row when a long name wraps.
 *
 * The old look keeps `ProMark`. Renders nothing when the shared table gives
 * the plan no badge.
 */
export function ProBadge({ fontSize, on = 'ground', style }: ProBadgeProps) {
  const t = useT()
  const { v3 } = useTheme()
  const height = proBadgeHeight(fontSize)
  const art = useMemo(() => proBadgeArt(height), [height])
  if (!TIER_BADGES.pro) return null

  const tablet = on === 'hue' ? v3.colors.ink : v3.colors.proTablet
  const word = on === 'hue' ? v3.colors.proWordOnInk : v3.colors.proWord
  const width = proBadgeWidth(art, height)

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('profile.proBadge')}
      style={[{ height, width }, style]}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${art.width} ${PRO_BADGE_ART_HEIGHT}`}>
        <Rect x={1} y={1} width={art.width - 2} height={22} rx={5.5} fill={tablet} />
        <Path
          d={art.letters}
          stroke={word}
          strokeWidth={art.stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <Path d={art.o} stroke={word} strokeWidth={art.stroke} fill="none" />
      </Svg>
    </View>
  )
}
