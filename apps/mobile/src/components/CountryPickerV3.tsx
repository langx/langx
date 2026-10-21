import Feather from '@expo/vector-icons/Feather'
import { Pressable, Text, TextInput, View } from 'react-native'
import { useT } from '../i18n'
import { makeStyles, useTheme } from '../lib/theme'

interface CountryOption {
  code: string
  /** The flag and the reader's own name for it, as `CountryPicker` builds them. */
  label: string
}

/**
 * `CountryPicker` in the redesign's look (V-Filters' Country), behind
 * `flags.v3Home`.
 *
 * The drawing has the field only: a 56pt grey pill with the search glyph at
 * its start. What a typed term offers, and how a chosen country shows, are
 * drawn in the page's own words — "a chosen country shows as a chip with a
 * cross" — so the offers are the page's 48pt language chips unticked
 * (`FilterChipV3`'s grey pill) and the choice is the same chip in ink with a
 * cross where the tick would be.
 *
 * Drawing only: the matching, the Pro lock and what a tap sends are
 * `CountryPicker.tsx`'s.
 */
export function CountryPickerV3({
  label,
  selected,
  term,
  onChangeTerm,
  matches,
  noMatch,
  onChoose,
}: {
  label?: string | undefined
  selected: CountryOption | undefined
  term: string
  onChangeTerm: (next: string) => void
  matches: readonly CountryOption[]
  /** The "nothing matches" line, already worded, or nothing. */
  noMatch: string | undefined
  onChoose: (code: string) => void
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  return (
    <View style={styles.root}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      {selected ? (
        <View style={styles.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={selected.label}
            accessibilityHint={t('common.remove')}
            onPress={() => onChoose('')}
            style={({ pressed }) => [styles.chip, styles.chosen, pressed && styles.pressed]}
          >
            <Text style={[styles.chipLabel, styles.chosenLabel]} numberOfLines={1}>
              {selected.label}
            </Text>
            <Feather name="x" size={v3.icon.sm} color={v3.colors.pillText} />
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.search}>
            <Feather name="search" size={v3.icon.md} color={v3.colors.muted} />
            <TextInput
              value={term}
              onChangeText={onChangeTerm}
              placeholder={t('pickers.searchCountries')}
              placeholderTextColor={v3.colors.muted}
              accessibilityLabel={t('pickers.searchCountries')}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
            />
          </View>
          {matches.length > 0 ? (
            <View style={styles.row}>
              {matches.map((country) => (
                <Pressable
                  key={country.code}
                  accessibilityRole="button"
                  onPress={() => onChoose(country.code)}
                  style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                >
                  <Text style={styles.chipLabel} numberOfLines={1}>
                    {country.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {noMatch ? <Text style={styles.hint}>{noMatch}</Text> : null}
        </>
      )}
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  root: { gap: v3.space[10] },
  label: { ...v3.type.button, color: v3.colors.fg },
  search: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[10],
    height: 56,
    paddingHorizontal: v3.space[16],
  },
  // `paddingVertical: 0`: Android's own TextInput padding would push the
  // words off the glyph beside them.
  input: { ...v3.type.body, color: v3.colors.fg, flex: 1, paddingVertical: 0 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[8] },
  chip: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[8],
    height: 48,
    maxWidth: '100%',
    paddingHorizontal: v3.space[16],
  },
  chosen: { backgroundColor: v3.colors.pill, paddingEnd: v3.space[14] },
  pressed: { opacity: 0.7 },
  chipLabel: { ...v3.type.button, color: v3.colors.fg, flexShrink: 1 },
  chosenLabel: { color: v3.colors.pillText },
  hint: { ...v3.type.caption, color: v3.colors.muted },
}))
