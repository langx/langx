import type { LanguageLevel } from '@langx/shared'
import { Pressable, Text, View } from 'react-native'
import { makeStyles, useTheme } from '../../lib/theme'
import { LevelBars } from '../ui/LevelBars'

/**
 * A learning language's level on Your languages (`V-Languages`): the four
 * levels as a two-by-two grid of radios, each with its bars before the word,
 * the chosen one in ink.
 *
 * The labels come from the screen, already translated, so the words are the
 * current screen's and the parity test can see them there. A radio group,
 * because exactly one level is always set — the old chips said nothing about
 * that to a screen reader.
 */
export function LevelChoiceV3({
  label,
  options,
  value,
  onChange,
}: {
  /** The group's name: "Your English level". */
  label: string
  options: readonly { level: LanguageLevel; label: string }[]
  value: LanguageLevel
  onChange: (level: LanguageLevel) => void
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.grid}>
      {options.map((option) => {
        const on = option.level === value
        return (
          <Pressable
            key={option.level}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.level)}
            style={({ pressed }) => [styles.cell, on && styles.on, pressed && styles.pressed]}
          >
            <LevelBars
              level={option.level}
              color={on ? v3.colors.pillText : v3.colors.fg}
              restColor={on ? v3.colors.muted : v3.colors.track}
              size={12}
            />
            <Text numberOfLines={1} style={[styles.label, on && styles.labelOn]}>
              {option.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: v3.space[6],
    paddingEnd: v3.space[8],
  },
  // Two to a row: the gap is taken out of each half so the pair fills it exactly.
  cell: {
    alignItems: 'center',
    backgroundColor: v3.colors.bg,
    borderColor: v3.colors.line,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    flexBasis: '48%',
    flexDirection: 'row',
    flexGrow: 1,
    gap: v3.space[6],
    height: 46,
    justifyContent: 'center',
    paddingHorizontal: v3.space[8],
  },
  on: { backgroundColor: v3.colors.pill, borderColor: v3.colors.pill },
  pressed: { opacity: 0.7 },
  label: { ...v3.type.buttonSmall, color: v3.colors.fg, flexShrink: 1 },
  labelOn: { color: v3.colors.pillText },
}))
