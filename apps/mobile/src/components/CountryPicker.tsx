import { COUNTRIES, countryFlag, getCountry, searchCountries } from '@langx/shared'
import { useMemo, useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { Chip } from './ui/Chip'
import { makeStyles, useTheme } from '../lib/theme'
import { useDisplayNames, useT } from '../i18n'

interface CountryPickerProps {
  /** ISO 3166-1 alpha-2, or empty for "not set". */
  value: string
  onChange: (code: string) => void
  label?: string
  /** Called instead of `onChange` when the picker is locked behind Pro. */
  onLocked?: () => void
}

/**
 * Search, then pick. Nothing is offered before a term is typed: the
 * alphabetically-first countries are not suggestions, they are noise shaped
 * like suggestions.
 *
 * One component for three screens — onboarding, edit-profile and the discovery
 * filter — because `profiles.country` and the discovery filter key on the same
 * two letters, and a typed field on one screen and a picker on another is how
 * they end up disagreeing. Before this, edit-profile asked people to type a
 * raw code and nothing stopped them typing it in lower case.
 */
export function CountryPicker({ value, onChange, label, onLocked }: CountryPickerProps) {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  const names = useDisplayNames()

  const [term, setTerm] = useState('')
  /**
   * English names *and* the reader's own, merged.
   *
   * `searchCountries` folds accents and ranks prefix matches, which is worth
   * keeping — but it only knows the English list, so on its own it answers
   * "Almanya" with nothing at all. The localized pass runs after it and only
   * adds codes the first one missed, so the better ranking still wins.
   */
  const matches = useMemo(() => {
    const ranked = searchCountries(term)
    const needle = term.trim().toLowerCase()
    if (!needle) return ranked

    const seen = new Set(ranked.map((country) => country.code))
    const localized = COUNTRIES.filter(
      (country) =>
        !seen.has(country.code) && names.country(country.code).toLowerCase().includes(needle),
    )
    return [...ranked, ...localized].slice(0, 24)
  }, [term, names])
  const selected = value ? getCountry(value) : undefined

  function choose(code: string): void {
    if (onLocked) {
      onLocked()
      return
    }
    onChange(code)
    setTerm('')
  }

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      {selected ? (
        <View style={styles.row}>
          <Chip
            label={`${countryFlag(selected.code)} ${names.country(selected.code)} ✕`}
            selected
            onPress={() => choose('')}
          />
        </View>
      ) : (
        <>
          <TextInput
            style={styles.search}
            value={term}
            onChangeText={setTerm}
            placeholder={t('pickers.searchCountries')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.row}>
            {matches.map((country) => (
              <Chip
                key={country.code}
                label={`${countryFlag(country.code)} ${names.country(country.code)}`}
                onPress={() => choose(country.code)}
              />
            ))}
          </View>
          {matches.length === 0 && term.trim() ? (
            <Text style={styles.hint}>{t('pickers.noCountryMatch', { query: term.trim() })}</Text>
          ) : null}
        </>
      )}
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  label: { ...font.label, color: colors.text, marginBottom: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  hint: { ...font.caption, color: colors.textMuted, marginTop: spacing.xs },
  search: {
    ...font.body,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
}))
