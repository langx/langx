import Feather from '@expo/vector-icons/Feather'
import { useState } from 'react'
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native'
import { useHandleSearch } from '../api/queries'
import { useDebounced } from '../hooks/useDebounced'
import { useT } from '../i18n'
import { openProfile } from '../lib/navigation'
import { makeStyles, useTheme } from '../lib/theme'
import { Avatar } from './ui/Avatar'

interface PeopleSearchProps {
  /** Where a tapped result should come back to. */
  from: '/(app)/discover' | '/(app)/chats'
  /** Told when search opens or closes, so the host can blank its own list. */
  onSearchingChange?: (searching: boolean) => void
}

/**
 * Find somebody by username, wherever you already are.
 *
 * Extracted from Discover so the Chats tab can have it too. It was forty-five
 * lines of JSX and eight style rules inlined into one screen, which is how a
 * second copy gets written rather than a component reused.
 *
 * Free on every plan, and always was: the endpoint behind it is `requireAuth`
 * with no tier check. Somebody who already knows the username is not browsing.
 */
export function PeopleSearch({ from, onSearchingChange }: PeopleSearchProps) {
  const t = useT()
  const styles = useStyles()
  const { colors } = useTheme()
  const [searching, setSearching] = useState(false)
  const [term, setTerm] = useState('')
  /*
   * Where the results start.
   *
   * Both hosts mount this inside their title row, which is a flex row — so a
   * results list laid out in normal flow becomes a *third column* beside the
   * title and the filter icon rather than a list under the field. Measuring
   * the field and floating the results under it is what keeps the component
   * droppable into a row without either host restructuring its header.
   */
  const [below, setBelow] = useState(0)
  // The input renders `term` and the query follows the settled value, so
  // typing stays responsive and "behic" is one request rather than five.
  const search = useHandleSearch(useDebounced(term))

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
    <View style={styles.wrap}>
      <View
        style={styles.field}
        onLayout={(event) => {
          const { y, height } = event.nativeEvent.layout
          setBelow(y + height)
        }}
      >
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
          value={term}
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
        {term.length > 0 ? (
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

      <View style={[styles.results, { top: below }]}>
        {search.isFetching ? <ActivityIndicator style={styles.spinner} /> : null}
        {search.data?.items.map((result) => (
          <Pressable
            key={result._id}
            accessibilityRole="button"
            onPress={() => openProfile(result.handle, from)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Avatar url={result.avatarUrl} name={result.displayName} size={36} />
            <View style={styles.text}>
              <Text style={styles.name} numberOfLines={1}>
                {result.displayName}
              </Text>
              <Text style={styles.handle} numberOfLines={1}>
                @{result.handle}
              </Text>
            </View>
          </Pressable>
        ))}
        {/* Only once a real search has settled: "no matches" under two letters
            would be answering a question nobody finished asking. */}
        {search.data?.items.length === 0 && !search.isFetching ? (
          <Text style={styles.none}>{t('discover.searchNone')}</Text>
        ) : null}
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  /*
   * `flex: 1` so the open field takes the row it was dropped into. Without it
   * the field is content-width, the row overflows, and the host's own title
   * slides off the leading edge — which is how this shipped and what it looked
   * like on a 420px screen.
   */
  wrap: { flex: 1 },
  toggle: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  pressed: { opacity: 0.7 },
  field: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingEnd: spacing.md,
    paddingStart: spacing.sm,
    paddingVertical: spacing.sm,
  },
  leave: { alignItems: 'center', height: 30, justifyContent: 'center', width: 30 },
  input: { ...font.body, color: colors.text, flex: 1, padding: 0 },
  /*
   * Floated, for the reason `below` records. `end: 0` rather than `right: 0`
   * so it follows the writing direction, and `zIndex` because the list it
   * covers is drawn after this in the tree.
   */
  results: {
    backgroundColor: colors.bg,
    end: 0,
    gap: spacing.xs,
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
    position: 'absolute',
    start: 0,
    zIndex: 2,
  },
  spinner: { marginTop: spacing.md },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm },
  text: { flex: 1, gap: 1 },
  name: { ...font.label, color: colors.text, fontSize: 15 },
  handle: { ...font.caption, color: colors.textMuted },
  none: { ...font.caption, color: colors.textFaint, marginTop: spacing.md, textAlign: 'center' },
}))
