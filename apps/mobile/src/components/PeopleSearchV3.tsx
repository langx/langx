import Feather from '@expo/vector-icons/Feather'
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native'
import type { HandleSearchResult } from '@langx/shared'
import { useLocale, useT } from '../i18n'
import { makeStyles, useTheme } from '../lib/theme'
import { OfficialMark } from './OfficialMark'
import { Avatar } from './ui/Avatar'
import { ICON_BUTTON_TARGET } from './ui/IconButton'

/**
 * The open half of `PeopleSearch` in the redesign's look, behind
 * `flags.v3Home`. V-People draws only the closed glyph and says the field
 * opens "in place of the header", so the field is the search pill the v3
 * Settings and language-pick screens already draw — a grey 52pt pill, the
 * glyph at its start, one cross at its end — and the results are the grey
 * block of people rows V-Likes and V-Follows draw (`PersonRowV3`), with the
 * official mark the current look shows beside a name.
 *
 * Drawing only. What was typed, the request, when "none" may be said and
 * where a tap goes all stay in `PeopleSearch.tsx`, so the two looks cannot
 * disagree about who is found.
 */
export function PeopleSearchFieldV3({
  value,
  onChangeText,
  onClose,
}: {
  value: string
  onChangeText: (next: string) => void
  onClose: () => void
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  return (
    <View style={styles.field}>
      <Feather name="search" size={v3.icon.md} color={v3.colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={t('discover.searchPlaceholder')}
        placeholderTextColor={v3.colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        returnKeyType="search"
        style={styles.input}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel')}
        onPress={onClose}
        hitSlop={8}
        style={({ pressed }) => [styles.close, pressed && styles.pressed]}
      >
        <Feather name="x" size={v3.icon.lg} color={v3.colors.fg} />
      </Pressable>
    </View>
  )
}

export function PeopleSearchResultsV3({
  items,
  fetching,
  none,
  onOpen,
}: {
  items: readonly HandleSearchResult[]
  fetching: boolean
  /** Whether a settled search found nobody — `PeopleSearch` decides. */
  none: boolean
  onOpen: (handle: string) => void
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { isRtl } = useLocale()
  const t = useT()
  return (
    <FlatList
      data={items}
      keyExtractor={(result) => result._id}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.results}
      ListHeaderComponent={
        fetching ? <ActivityIndicator color={v3.colors.muted} style={styles.spinner} /> : null
      }
      ListEmptyComponent={none ? <Text style={styles.none}>{t('discover.searchNone')}</Text> : null}
      renderItem={({ item: result, index }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() => onOpen(result.handle)}
          style={({ pressed }) => [
            styles.row,
            index === 0 && styles.first,
            index === items.length - 1 && styles.last,
            index > 0 && styles.divided,
            pressed && styles.rowPressed,
          ]}
        >
          <Avatar url={result.avatarUrl} name={result.displayName} seed={result._id} size={48} />
          <View style={styles.text}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {result.displayName}
              </Text>
              {result.official ? <OfficialMark size={v3.icon.xs} /> : null}
            </View>
            <Text style={styles.handle} numberOfLines={1}>
              @{result.handle}
            </Text>
          </View>
          <Feather
            name={isRtl ? 'chevron-left' : 'chevron-right'}
            size={v3.icon.md}
            color={v3.colors.muted}
          />
        </Pressable>
      )}
    />
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  // `flex: 1` for the reason the current look's field gives: it takes the
  // title row it replaces, or the row overflows and pushes the title out.
  field: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    flex: 1,
    flexDirection: 'row',
    gap: v3.space[10],
    height: 52,
    paddingEnd: v3.space[4],
    paddingStart: v3.space[16],
  },
  // `paddingVertical: 0`: Android's own TextInput padding would push the
  // words off the glyph beside them.
  input: { ...v3.type.body, color: v3.colors.fg, flex: 1, paddingVertical: 0 },
  close: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    height: ICON_BUTTON_TARGET,
    justifyContent: 'center',
    width: ICON_BUTTON_TARGET,
  },
  pressed: { opacity: 0.7 },
  results: { paddingBottom: v3.space[16], paddingTop: v3.space[4] },
  spinner: { marginVertical: v3.space[16] },
  row: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 68,
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[10],
  },
  first: { borderTopLeftRadius: v3.radius.tile, borderTopRightRadius: v3.radius.tile },
  last: { borderBottomLeftRadius: v3.radius.tile, borderBottomRightRadius: v3.radius.tile },
  divided: { borderTopColor: v3.colors.line, borderTopWidth: 1 },
  rowPressed: { backgroundColor: v3.colors.line },
  text: { flex: 1, gap: v3.space[2], minWidth: 0 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: v3.space[6] },
  name: { ...v3.type.button, color: v3.colors.fg, flexShrink: 1 },
  handle: { ...v3.type.caption, color: v3.colors.muted },
  none: {
    ...v3.type.callout,
    color: v3.colors.muted,
    paddingVertical: v3.space[32],
    textAlign: 'center',
  },
}))
