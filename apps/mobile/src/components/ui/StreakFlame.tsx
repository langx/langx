import { Text, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useLocale, useT } from '../../i18n'
import { makeStyles, useTheme, type PartnerHue, type V3TypeStep } from '../../lib/theme'

/**
 * The flame, as the drawings draw it: an outline in the text's colour, not
 * the 🔥 emoji. An emoji is drawn by each platform in its own colours and
 * proportions, which is why the stat tiles stopped gluing one into a number
 * (see `StatTile`), and it cannot take ink on a partner's hue.
 *
 * Feather has no flame — the reason the drawings' own path is here rather
 * than a glyph name — and `react-native-svg` is already in every build that
 * can receive this (`UploadRing` draws with it).
 */
export function FlameGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21c-3.9 0-7-2.8-7-6.6 0-3.1 2-5.4 3.6-7 .4 1.8 1.4 3 2.6 3.4C11 7.6 12.3 5 14.6 3c.3 2.6 1.5 4.3 2.8 5.8 1.3 1.5 1.6 3.2 1.6 5.6 0 3.8-3.1 6.6-7 6.6z"
        stroke={color}
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

type FlameSize = 'row' | 'title' | 'hero'

/** Glyph and number per size, as the drawings pair them. */
const SIZES: Record<FlameSize, { glyph: number; step: V3TypeStep }> = {
  /** Beside a name in a chat row or a partner tile: "Elif 🔥4". */
  row: { glyph: 18, step: 'headline' },
  /** The streak card's line on Home, the next-step card's "9 days together". */
  title: { glyph: 30, step: 'title' },
  /** The streak screen's hero: the number is the screen. */
  hero: { glyph: 44, step: 'numeral' },
}

interface StreakFlameProps {
  count: number
  /**
   * Whose run it is. `solo` is the person's own streak; `pair` is the days
   * two partners have both written — what a screen reader hears differs,
   * since the same "9" means "a 9 day streak" in one place and "9 days
   * together" in the other.
   */
  kind?: 'solo' | 'pair'
  size?: FlameSize
  /**
   * What it stands on: the ground, in the text colour, or a partner's hue,
   * in ink — which is the same in both schemes, because the hues are light
   * in both.
   */
  on?: 'ground' | 'hue'
}

/**
 * The flame and its count, read as one thing.
 *
 * Static on purpose. It sits in chat rows, which are recycled, and a row
 * handed a different partner's count would play a "grew" animation for a
 * number that did not grow. A count that goes up in front of the person is
 * a celebration's job (`CelebrationSheet`), not the flame's.
 */
export function StreakFlame({
  count,
  kind = 'solo',
  size = 'row',
  on = 'ground',
}: StreakFlameProps) {
  const t = useT()
  const { locale } = useLocale()
  const styles = useStyles()
  const { v3 } = useTheme()
  const color = on === 'hue' ? v3.colors.ink : v3.colors.fg
  const { glyph, step } = SIZES[size]
  const label =
    kind === 'pair' ? t('streak.daysTogether', { count }) : t('profile.dayStreak', { count })

  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[styles.row, size === 'hero' && styles.rowHero]}
    >
      <FlameGlyph size={glyph} color={color} />
      <Text
        style={[v3.type[step], { color }]}
        // The hero's number is a figure in a fixed block, not reading text:
        // at the largest sizes three digits would leave the block. Its unit
        // beside it still scales in full.
        {...(size === 'hero' ? { maxFontSizeMultiplier: 1.4 } : {})}
      >
        {count.toLocaleString(locale)}
      </Text>
    </View>
  )
}

/**
 * The pair flame as a chip — the celebration's "🔥 9" on a partner's colour:
 * ink, with the partner's hue for the flame and the number. The one place
 * the hue is the text and ink the ground (a pair `contrast.test.ts` measures).
 */
export function PairFlameChip({ count, hue }: { count: number; hue: PartnerHue }) {
  const t = useT()
  const { locale } = useLocale()
  const styles = useStyles()
  const { v3 } = useTheme()
  const color = v3.hues[hue]
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={t('streak.daysTogether', { count })}
      style={styles.chip}
    >
      <FlameGlyph size={26} color={color} />
      <Text style={[styles.chipCount, { color }]}>{count.toLocaleString(locale)}</Text>
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  row: { alignItems: 'center', flexDirection: 'row', gap: v3.space[4] },
  rowHero: { gap: v3.space[6] },
  chip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: v3.colors.ink,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[6],
    minHeight: 52,
    paddingEnd: v3.space[16],
    paddingStart: v3.space[12],
  },
  chipCount: v3.type.title,
}))
