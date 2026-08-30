import { LANGUAGES, SUPPORTED_LOCALES } from '@langx/shared'
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
  /** What a disabled row says instead of a tick — "Learning" on the native tab. */
  disabledLabel?: string
  max?: number
}

/**
 * The interface locales, as speakable languages, in the catalogue's own order.
 *
 * These are the languages the app was deliberately translated into — which is
 * the closest thing to "where the users are" that ships with the binary — so
 * the picker pins them above the other ~180 rather than burying Turkish under
 * Tsonga. `pt-BR` is a locale, not a language; it pins `pt`.
 */
const PINNED_CODES = SUPPORTED_LOCALES.map((locale) => locale.split('-')[0] as string)

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
  disabledLabel,
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
    // them, so deselecting never requires clearing the search first. Below
    // them, the pinned interface languages; the long tail after that.
    const chosen = LANGUAGES.filter((l) => selected.includes(l.code))
    const rest = pool.filter((l) => !selected.includes(l.code))
    const pinned = rest.filter((l) => PINNED_CODES.includes(l.code))
    const tail = rest.filter((l) => !PINNED_CODES.includes(l.code))
    return [...chosen, ...pinned, ...tail].slice(0, 60)
  }, [query, selected, names])

  const atLimit = max !== undefined && selected.length >= max

  return (
    <View style={styles.root}>
      <View style={styles.searchRow}>
        <Feather name="search" size={17} color={colors.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('pickers.searchLanguages', { count: LANGUAGES.length })}
          placeholderTextColor={colors.textFaint}
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
          const isTaken = disabledCodes.includes(item.code)
          const isDisabled = isTaken || (atLimit && !isSelected)
          return (
            <Pressable
              disabled={isDisabled}
              onPress={() => onToggle(item.code)}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <View style={styles.rowText}>
                <Text
                  style={[
                    styles.name,
                    isSelected && styles.nameSelected,
                    isDisabled && styles.nameDisabled,
                  ]}
                >
                  {names.language(item.code)}
                </Text>
                <Text style={styles.native}>{item.nativeName}</Text>
              </View>
              {/*
                The right edge says the row's state in one glyph or word: a blue
                tick for chosen, the other tab's name for taken. v3 drops the
                tick circles — the column of blue ticks is what says how many
                are chosen.
              */}
              {isSelected ? (
                <Feather name="check" size={20} color={colors.accent} />
              ) : isTaken && disabledLabel ? (
                <Text style={styles.taken}>{disabledLabel}</Text>
              ) : null}
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
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.sm + 2,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg + 2,
  },
  search: { color: colors.text, flex: 1, fontSize: 15, paddingVertical: 13 },
  list: { flex: 1 },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md + 2,
    paddingVertical: 15,
  },
  rowPressed: { opacity: 0.6 },
  rowText: { flex: 1 },
  name: { color: colors.text, fontSize: 17 },
  nameSelected: { fontWeight: '700' },
  nameDisabled: { color: colors.textFaint },
  native: { ...font.caption, color: colors.textFaint, marginTop: 1 },
  taken: { color: colors.accent, fontSize: 13, fontWeight: '600' },
}))
