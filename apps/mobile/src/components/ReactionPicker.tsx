import { Ionicons } from '@expo/vector-icons'
import { useEffect, useMemo, useState } from 'react'
import { FlatList, Pressable, Text, TextInput, View } from 'react-native'
import type { EmojiGroupId } from '../lib/emojiData'
import {
  emojiGroups,
  readRecentReactions,
  searchEmoji,
  withRecentReaction,
  type PickerEmoji,
} from '../lib/emojiPicker'
import { FLAG_KEYS, readJsonFlag, writeJsonFlag } from '../lib/localFlags'
import { makeStyles, useTheme } from '../lib/theme'
import { useT } from '../i18n'

type Tab = EmojiGroupId | 'recent'

/** Icons rather than a sample emoji per tab: they read as navigation, not as choices. */
const TAB_ICONS: Record<Tab, string> = {
  recent: 'time-outline',
  smileys: 'happy-outline',
  people: 'people-outline',
  nature: 'leaf-outline',
  food: 'fast-food-outline',
  travel: 'car-outline',
  activities: 'football-outline',
  objects: 'bulb-outline',
  symbols: 'shapes-outline',
  flags: 'flag-outline',
}

const COLUMNS = 8
const CELL = 40
const ROWS = 6

/**
 * Every emoji, for a reaction the strip does not carry. Opened by the strip's
 * "+" inside the message menu, and answers with one emoji through `onPick`.
 */
export function ReactionPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<Tab>('smileys')
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => {
    let live = true
    void readJsonFlag<unknown>(FLAG_KEYS.recentReactions).then((stored) => {
      const list = readRecentReactions(stored)
      if (!live || list.length === 0) return
      setRecent(list)
      // Opens on what was used last, the way the phone's own keyboard does —
      // unless a tab was already chosen while storage was being read.
      setTab((current) => (current === 'smileys' ? 'recent' : current))
    })
    return () => {
      live = false
    }
  }, [])

  const groups = emojiGroups()
  const shown: readonly PickerEmoji[] = useMemo(() => {
    if (query.trim()) return searchEmoji(query)
    if (tab === 'recent') return recent.map((emoji) => ({ emoji, name: emoji }))
    return groups.find((group) => group.id === tab)?.emoji ?? []
  }, [groups, query, recent, tab])

  const pick = (emoji: string): void => {
    void writeJsonFlag(FLAG_KEYS.recentReactions, withRecentReaction(recent, emoji))
    onPick(emoji)
  }

  const tabs: Tab[] = [
    ...(recent.length > 0 ? (['recent'] as const) : []),
    ...groups.map((g) => g.id),
  ]

  return (
    <View style={styles.root}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={17} color={colors.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('messageMenu.emojiSearch')}
          placeholderTextColor={colors.textFaint}
          style={styles.search}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
      </View>

      {query.trim() ? null : (
        <View style={styles.tabs}>
          {tabs.map((id) => (
            <Pressable
              key={id}
              accessibilityRole="tab"
              accessibilityLabel={t(`messageMenu.emojiGroups.${id}`)}
              accessibilityState={{ selected: tab === id }}
              onPress={() => setTab(id)}
              style={[styles.tab, tab === id && styles.tabChosen]}
            >
              <Ionicons
                // The icon set types its own names; the table above is plain data.
                name={TAB_ICONS[id] as never}
                size={18}
                color={tab === id ? colors.accent : colors.textMuted}
              />
            </Pressable>
          ))}
        </View>
      )}

      <FlatList
        data={shown}
        keyExtractor={(item) => item.emoji}
        numColumns={COLUMNS}
        style={styles.grid}
        keyboardShouldPersistTaps="handled"
        // Rows, not cells: with columns the list windows by row.
        initialNumToRender={ROWS}
        ListEmptyComponent={<Text style={styles.empty}>{t('messageMenu.emojiNoResults')}</Text>}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('messageMenu.reactWith', { emoji: item.emoji })}
            onPress={() => pick(item.emoji)}
            style={({ pressed }) => [styles.cell, pressed && styles.cellPressed]}
          >
            <Text style={styles.glyph}>{item.emoji}</Text>
          </Pressable>
        )}
      />
    </View>
  )
}

/** The grid and its gutters; narrower screens get `width: 100%` instead. */
const REACTION_PICKER_WIDTH = COLUMNS * CELL + 16

const useStyles = makeStyles(({ colors, spacing, radius }) => ({
  root: { alignSelf: 'center', maxWidth: REACTION_PICKER_WIDTH, width: '100%' },
  searchRow: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  search: { color: colors.text, flex: 1, fontSize: 15, paddingVertical: 10 },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  tab: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  // Blue carries everything chosen in v3, as on the strip.
  tabChosen: { backgroundColor: colors.accentBg },
  grid: { height: CELL * ROWS, marginTop: spacing.sm },
  cell: {
    alignItems: 'center',
    borderRadius: radius.sm,
    height: CELL,
    justifyContent: 'center',
    width: `${100 / COLUMNS}%`,
  },
  cellPressed: { backgroundColor: colors.fill },
  glyph: { fontSize: 26, lineHeight: 32 },
  empty: {
    color: colors.textMuted,
    fontSize: 15,
    paddingVertical: spacing.xl,
    textAlign: 'center',
  },
}))
