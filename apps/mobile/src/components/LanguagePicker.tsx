import { LANGUAGES } from '@langx/shared'
import { useMemo, useState } from 'react'
import Feather from '@expo/vector-icons/Feather'
import { FlatList, Pressable, Text, TextInput, View } from 'react-native'
import { makeStyles, useTheme } from '../lib/theme'
import { useDisplayNames, useT } from '../i18n'

interface LanguagePickerProps {
  selected: string[]
  onToggle: (code: string) => void
  /** Codes that cannot be picked here because they are already used elsewhere. */
  disabledCodes?: string[]
  max?: number
}

/**
 * 180-odd languages is too many to scroll and exactly right to search. The
 * filter matches English name, native name and code, because a Turkish user
 * looking for German may type "Almanca", "Deutsch", "German" or "de" — and one
 * of those failing looks like the language is missing.
 */
export function LanguagePicker({
  selected,
  onToggle,
  disabledCodes = [],
  max,
}: LanguagePickerProps) {
  const { colors } = useTheme()
  const t = useT()
  const names = useDisplayNames()
  const styles = useStyles()

  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = q
      ? LANGUAGES.filter(
          (l) =>
            // The localized name first: a Turkish reader looking for German
            // types "Almanca", and matching only `l.name` would tell them the
            // language they can see in the list does not exist.
            names.language(l.code).toLowerCase().includes(q) ||
            l.name.toLowerCase().includes(q) ||
            l.nativeName.toLowerCase().includes(q) ||
            l.code === q,
        )
      : LANGUAGES
    // Chosen languages stay visible at the top even when the query excludes
    // them, so deselecting never requires clearing the search first.
    const chosen = LANGUAGES.filter((l) => selected.includes(l.code))
    const rest = pool.filter((l) => !selected.includes(l.code))
    return [...chosen, ...rest].slice(0, 60)
  }, [query, selected, names])

  const atLimit = max !== undefined && selected.length >= max

  return (
    <View style={styles.root}>
      <View style={styles.searchRow}>
        <Feather name="search" size={17} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('pickers.searchLanguages', { count: LANGUAGES.length })}
          placeholderTextColor={colors.textMuted}
          style={styles.search}
          autoCorrect={false}
        />
      </View>
      <FlatList
        data={results}
        keyExtractor={(item) => item.code}
        keyboardShouldPersistTaps="handled"
        style={styles.list}
        renderItem={({ item }) => {
          const isSelected = selected.includes(item.code)
          const isDisabled = disabledCodes.includes(item.code) || (atLimit && !isSelected)
          return (
            <Pressable
              disabled={isDisabled}
              onPress={() => onToggle(item.code)}
              style={({ pressed }) => [
                styles.row,
                isSelected && styles.rowSelected,
                isDisabled && styles.rowDisabled,
                pressed && styles.rowPressed,
              ]}
            >
              {/*
                The tick is a filled circle rather than a bare glyph: at a
                glance the column of circles is what says how many are chosen,
                and an empty ring in the same place is what says the row is
                choosable at all.
              */}
              <View style={[styles.tick, isSelected ? styles.tickOn : styles.tickOff]}>
                {isSelected ? <Feather name="check" size={13} color={colors.primaryText} /> : null}
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.name, isSelected && styles.nameSelected]}>
                  {names.language(item.code)}
                </Text>
                <Text style={styles.native}>{item.nativeName}</Text>
              </View>
            </Pressable>
          )
        }}
      />
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  root: { flex: 1 },
  searchRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  search: { ...font.body, color: colors.text, flex: 1, paddingVertical: 13 },
  list: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flex: 1,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  rowSelected: {},
  rowDisabled: { opacity: 0.35 },
  rowPressed: { opacity: 0.6 },
  rowText: { flex: 1 },
  tick: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  tickOn: { backgroundColor: colors.primary },
  tickOff: { borderColor: colors.border, borderWidth: 1.5 },
  name: { ...font.body, color: colors.text },
  nameSelected: { fontWeight: '600' },
  native: { ...font.caption, color: colors.textMuted },
}))
