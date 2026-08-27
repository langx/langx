import { LANGUAGES } from '@langx/shared'
import { useMemo, useState } from 'react'
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { colors, font, radius, spacing } from '../lib/theme'

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
  const [query, setQuery] = useState('')

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pool = q
      ? LANGUAGES.filter(
          (l) =>
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
  }, [query, selected])

  const atLimit = max !== undefined && selected.length >= max

  return (
    <View style={styles.root}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search languages…"
        placeholderTextColor={colors.textMuted}
        style={styles.search}
        autoCorrect={false}
      />
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
              <View style={styles.rowText}>
                <Text style={[styles.name, isSelected && styles.nameSelected]}>{item.name}</Text>
                <Text style={styles.native}>{item.nativeName}</Text>
              </View>
              {isSelected ? <Text style={styles.check}>✓</Text> : null}
            </Pressable>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  search: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    color: colors.text,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...font.body,
  },
  list: { flex: 1 },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  rowSelected: { backgroundColor: colors.surface },
  rowDisabled: { opacity: 0.35 },
  rowPressed: { opacity: 0.6 },
  rowText: { flex: 1 },
  name: { ...font.body, color: colors.text },
  nameSelected: { fontWeight: '700' },
  native: { ...font.caption, color: colors.textMuted },
  check: { color: colors.accent, fontSize: 18, fontWeight: '700' },
})
