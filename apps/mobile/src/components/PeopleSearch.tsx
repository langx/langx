import Feather from '@expo/vector-icons/Feather'
import { useState, useSyncExternalStore } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native'
import { useHandleSearch } from '../api/queries'
import { useDebounced } from '../hooks/useDebounced'
import { useT } from '../i18n'
import { openProfile } from '../lib/navigation'
import { makeStyles, useTheme } from '../lib/theme'
import { Avatar } from './ui/Avatar'

type SearchHost = '/(app)/(tabs)/discover' | '/(app)/(tabs)/chats'

interface PeopleSearchProps {
  /** Where a tapped result should come back to. */
  from: SearchHost
  /** Told when search opens or closes, so the host can swap its list for the results. */
  onSearchingChange?: (searching: boolean) => void
}

/*
 * The term lives outside React, shared by the field and the results.
 *
 * The two used to be one component, with the results floated absolutely
 * under the field so the title row would not gain a third column. They were
 * visible and could not be tapped: the list extended far outside its
 * parents' frames, which iOS does not hit-test into, and on web the host's
 * own FlatList — still mounted with no data — sat behind it taking the
 * pointer. So the results now render where the host's list was, in normal
 * flow, and the field just has to tell them what was typed. A module-level
 * store is the same shape `useTips` and `useOnboardingDraft` use, and needs no
 * provider around two tab roots.
 */
let term = ''
const listeners = new Set<() => void>()

function setTerm(next: string): void {
  term = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function useTerm(): string {
  return useSyncExternalStore(
    subscribe,
    () => term,
    () => term,
  )
}

/**
 * Find somebody by username, wherever you already are.
 *
 * The field half. It sits in the host's title row and owns whether search is
 * open; `PeopleSearchResults` is the other half and goes where the host's
 * list was. Free on every plan, and always was: the endpoint behind it is
 * `requireAuth` with no tier check. Somebody who already knows the username
 * is not browsing.
 */
export function PeopleSearch({ onSearchingChange }: PeopleSearchProps) {
  const t = useT()
  const styles = useStyles()
  const { colors } = useTheme()
  const [searching, setSearching] = useState(false)
  const current = useTerm()

  function open(next: boolean): void {
    setSearching(next)
    if (!next) setTerm('')
    onSearchingChange?.(next)
  }

  if (!searching) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('discover.searchHandles')}
        onPress={() => open(true)}
        style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
        hitSlop={8}
      >
        <Feather name="search" size={22} color={colors.text} />
      </Pressable>
    )
  }

  return (
    <View style={styles.field}>
      {/*
        Leaving search is local state, never navigation. Both hosts are tab
        roots, so `router.back()` would drop the reader on the first tab —
        see `backHref` for why `canGoBack()` does not save you there.
      */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.backPlain')}
        onPress={() => open(false)}
        hitSlop={12}
        style={({ pressed }) => [styles.leave, pressed && styles.pressed]}
      >
        <Feather name="arrow-left" size={22} color={colors.text} />
      </Pressable>
      <TextInput
        value={current}
        onChangeText={setTerm}
        placeholder={t('discover.searchPlaceholder')}
        placeholderTextColor={colors.textFaint}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        returnKeyType="search"
        style={styles.input}
      />
      {/*
        Clears the text without leaving search — a different intent from the
        arrow, which is why it is a different control rather than one button
        meaning two things.
      */}
      {current.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.clear')}
          onPress={() => setTerm('')}
          hitSlop={10}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Feather name="x" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  )
}

/**
 * The results, rendered by the host in place of its own list while search is
 * open. In normal flow, so every row is inside its parents' frames and a tap
 * lands on it — and `keyboardShouldPersistTaps`, or the first tap with the
 * keyboard up would only dismiss the keyboard.
 */
export function PeopleSearchResults({ from }: { from: SearchHost }) {
  const t = useT()
  const styles = useStyles()
  const current = useTerm()
  // The input renders the term and the query follows the settled value, so
  // typing stays responsive and "behic" is one request rather than five.
  const search = useHandleSearch(useDebounced(current))
  const items = search.data?.items ?? []

  return (
    <FlatList
      data={items}
      keyExtractor={(result) => result._id}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.results}
      ListHeaderComponent={search.isFetching ? <ActivityIndicator style={styles.spinner} /> : null}
      ListEmptyComponent={
        /* Only once a real search has settled: "no matches" under two letters
           would be answering a question nobody finished asking. */
        search.data && items.length === 0 && !search.isFetching ? (
          <Text style={styles.none}>{t('discover.searchNone')}</Text>
        ) : null
      }
      renderItem={({ item: result }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() => openProfile(result.handle, from)}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          <Avatar url={result.avatarUrl} name={result.displayName} seed={result._id} size={36} />
          <View style={styles.text}>
            <Text style={styles.name} numberOfLines={1}>
              {result.displayName}
            </Text>
            <Text style={styles.handle} numberOfLines={1}>
              @{result.handle}
            </Text>
          </View>
        </Pressable>
      )}
    />
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  toggle: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  pressed: { opacity: 0.7 },
  /*
   * `flex: 1` so the open field takes the row it was dropped into. Without it
   * the field is content-width, the row overflows, and the host's own title
   * slides off the leading edge — which is how this shipped and what it looked
   * like on a 420px screen.
   */
  field: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingEnd: spacing.md,
    paddingStart: spacing.sm,
    paddingVertical: spacing.sm,
  },
  leave: { alignItems: 'center', height: 30, justifyContent: 'center', width: 30 },
  input: { ...font.body, color: colors.text, flex: 1, padding: 0 },
  results: { gap: spacing.xs, paddingBottom: spacing.md, paddingTop: spacing.xs },
  spinner: { marginTop: spacing.md },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm },
  text: { flex: 1, gap: 1 },
  name: { ...font.label, color: colors.text, fontSize: 15 },
  handle: { ...font.caption, color: colors.textMuted },
  none: { ...font.caption, color: colors.textFaint, marginTop: spacing.md, textAlign: 'center' },
}))
