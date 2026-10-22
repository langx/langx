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
   * What it stands on: the ground, or a partner's hue. On a hue the pill is
   * the deeper violet in both schemes, the one that holds on all six.
   */
  on?: 'ground' | 'hue'
  style?: StyleProp<ViewStyle>
}

/**
 * v3's PRO badge: a violet pill with a white star and PRO, set in a name's
 * line the way a verified tick is.
 *
 * It replaces an ink tablet with a lilac word, which read as one more tag on
 * the hue rather than as the plan. The star is what Pro wears everywhere
 * else — the old chip, the Pro Week tag, the plan mark on the Pro sheets —
 * and the violet is the plan's own colour, so the badge says which plan at a
 * glance instead of asking to be read. Still a word with its star rather
 * than a shape on its own, so it is never the official account's tick or a
 * badge patch, and still no yellow, the screen's one committing colour. Its
 * bottom edge is its baseline: in a row aligned on `baseline` it stands on
 * the text's baseline with its top at the capitals, and drops to the next
 * line with the rest of the row when a long name wraps.
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

  const pill = on === 'hue' ? v3.colors.proBadgeOnHue : v3.colors.proBadge
  const mark = v3.colors.onProBadge
  const width = proBadgeWidth(art, height)

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('profile.proBadge')}
      style={[{ height, width }, style]}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${art.width} ${PRO_BADGE_ART_HEIGHT}`}>
        <Rect x={1} y={1} width={art.width - 2} height={22} rx={11} fill={pill} />
        <Path
          d={art.star}
          fill={mark}
          stroke={mark}
          strokeWidth={art.starRound}
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
