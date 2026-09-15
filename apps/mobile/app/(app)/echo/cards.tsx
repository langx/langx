import Feather from '@expo/vector-icons/Feather'
import type { EchoCard } from '@langx/shared'
import { router } from 'expo-router'
import { useState } from 'react'
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native'
import {
  useArchiveEchoCards,
  useEchoCards,
  useEchoSummary,
  useRemoveEcho,
} from '../../../src/api/queries'
import { LoadFailed } from '../../../src/components/LoadFailed'
import { SwipeableRow } from '../../../src/components/SwipeableRow'
import { Button } from '../../../src/components/ui/Button'
import { Chip } from '../../../src/components/ui/Chip'
import { SegmentedControl } from '../../../src/components/ui/SegmentedControl'
import { EmptyState } from '../../../src/components/ui/EmptyState'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { useT } from '../../../src/i18n'
import { useDisplayNames } from '../../../src/i18n/displayNames'
import { useDebounced } from '../../../src/hooks/useDebounced'
import { usePullToRefresh } from '../../../src/hooks/usePullToRefresh'
import { chooseAlert, confirmAlert, showAlert } from '../../../src/lib/alert'
import { dedupeById } from '../../../src/lib/dedupeById'
import { dueInCompact } from '../../../src/lib/format'
import { listState } from '../../../src/lib/listState'
import { goBackTo } from '../../../src/lib/navigation'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { showToast } from '../../../src/lib/toast'

/** Everything kept, and the two things this screen is for: fixing a card, and taking it back. */
export default function EchoCardsScreen() {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const names = useDisplayNames()

  const summary = useEchoSummary()
  const [lang, setLang] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  /*
   * Debounced, so the request follows the typing rather than racing it; the
   * empty state reads this one too, not the raw field, or "nothing matches"
   * appears a keystroke before the answer that would disprove it.
   */
  const term = useDebounced(query.trim())
  /*
   * The rotation or the archive, never both at once: an archived card
   * sitting between two that are still coming back would make the word mean
   * nothing here.
   */
  const [archived, setArchived] = useState(false)
  const cards = useEchoCards(lang ?? undefined, term || undefined, archived)
  const removeEcho = useRemoveEcho()
  const archive = useArchiveEchoCards()
  const [openRow, setOpenRow] = useState<string | null>(null)
  /*
   * `null` is not selecting. An empty set is selecting nothing yet — and the
   * two are different screens: one has a row you can tap to open, the other
   * has a row you tap to choose.
   */
  const [selected, setSelected] = useState<Set<string> | null>(null)
  const pull = usePullToRefresh(async () => {
    await cards.refetch()
  })

  const items = dedupeById(cards.data?.pages.flatMap((page) => page.items) ?? [])
  const languages = summary.data?.languages ?? []
  const state = listState({
    isPending: cards.isPending,
    isError: cards.isError,
    itemCount: items.length,
    isPaused: cards.fetchStatus === 'paused',
  })

  /**
   * Put cards in the archive, or take them back out.
   *
   * The toast carries the count rather than the sentence naming one card: the
   * action is usually several, and the number is the only part a person needs
   * to check against what they picked.
   */
  function setArchivedOn(cardIds: string[], archive_: boolean): void {
    if (cardIds.length === 0) return
    archive.mutate(
      { cardIds, archived: archive_ },
      {
        onSuccess: () => {
          setSelected(null)
          showToast(
            archive_
              ? t('echo.archivedToast', { count: cardIds.length })
              : t('echo.restoredToast', { count: cardIds.length }),
          )
        },
        onError: () => showToast(t('common.retry')),
      },
    )
  }

  function toggleSelected(cardId: string): void {
    setSelected((current) => {
      const next = new Set(current ?? [])
      if (next.has(cardId)) next.delete(cardId)
      else next.add(cardId)
      return next
    })
  }

  async function confirmRemove(card: EchoCard): Promise<void> {
    const yes = await confirmAlert({
      title: t('echo.removeTitle'),
      message: t('echo.removeBody'),
      confirmLabel: t('echo.remove'),
      destructive: true,
    })
    if (!yes) return
    try {
      await removeEcho.mutateAsync({ idOrSourceKey: card._id })
      showToast(t('echo.removed'))
    } catch {
      await showAlert(t('echo.removeFailedTitle'), t('common.retry'))
    }
  }

  /*
   * The same action twice, on purpose. `SwipeableRow` turns itself off where
   * there is no touch screen, so a swipe-only delete would leave every web
   * user with a card they cannot get rid of — which is the argument
   * `chats.tsx` makes for doing both there.
   */
  async function openMore(card: EchoCard): Promise<void> {
    const choice = await chooseAlert(t('echo.cards'), undefined, [
      { label: t('common.edit'), value: 'edit' as const },
      {
        label: archived ? t('echo.unarchive') : t('echo.archiveCard'),
        value: 'archive' as const,
      },
      { label: t('echo.selectCards'), value: 'select' as const },
      { label: t('echo.remove'), value: 'remove' as const, destructive: true },
    ])
    if (choice === 'edit') openEdit(card)
    if (choice === 'archive') setArchivedOn([card._id], !archived)
    if (choice === 'select') setSelected(new Set([card._id]))
    if (choice === 'remove') await confirmRemove(card)
  }

  /*
   * Only the id. The card used to travel in the params, because this list was
   * already holding it and the module had no endpoint for a single card;
   * there is one now, and a card's recordings are a list that would not have
   * fitted in a query string anyway.
   */
  function openEdit(card: EchoCard): void {
    router.push({ pathname: '/(app)/echo/edit', params: { id: card._id } })
  }

  /** The card itself, read-only — where a row goes when it is tapped. */
  function openCard(card: EchoCard): void {
    router.push({ pathname: '/(app)/echo/card/[id]', params: { id: card._id } })
  }

  function sourceLabel(card: EchoCard): string {
    if (card.source.kind === 'post') return t('echo.fromAPost')
    if (card.source.kind === 'manual') return t('echo.fromYourself')
    return names.language(card.lang)
  }

  return (
    <Screen fluid>
      <ScreenHeader
        title={t('echo.cards')}
        onBack={() => goBackTo('/(app)/(tabs)/echo')}
        trailing={
          selected ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => setSelected(null)}
              style={({ pressed }) => (pressed ? styles.pressed : null)}
            >
              <Text style={styles.headerAction}>{t('common.done')}</Text>
            </Pressable>
          ) : (
            <View style={styles.headerActions}>
              {items.length > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('echo.selectCards')}
                  hitSlop={12}
                  onPress={() => setSelected(new Set())}
                  style={({ pressed }) => (pressed ? styles.pressed : null)}
                >
                  <Feather name="check-square" size={20} color={colors.text} />
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('echo.newTitle')}
                hitSlop={12}
                onPress={() => router.push('/(app)/echo/new')}
                style={({ pressed }) => (pressed ? styles.pressed : null)}
              >
                <Feather name="plus" size={22} color={colors.text} />
              </Pressable>
            </View>
          )
        }
      />
      <View style={styles.search}>
        <Feather name="search" size={18} color={colors.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('echo.searchPlaceholder')}
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel={t('echo.searchPlaceholder')}
          style={styles.searchInput}
        />
      </View>

      {/*
        The cards in rotation or the archive: two tabs, the shape `chats.tsx`
        and `feed.tsx` use for the same kind of choice — one list at a time,
        the server doing the narrowing. Always drawn, even on an empty archive:
        it is the only place the action's result can be seen, and a control
        that appears once something is in it cannot teach that.
      */}
      <View style={styles.tabs}>
        <SegmentedControl<'active' | 'archived'>
          options={[
            { value: 'active', label: t('echo.activeTab') },
            { value: 'archived', label: t('echo.archived') },
          ]}
          selected={[archived ? 'archived' : 'active']}
          onToggle={(value) => {
            setArchived(value === 'archived')
            setSelected(null)
          }}
          accessibilityLabel={t('echo.cards')}
        />
      </View>

      {languages.length > 1 ? (
        <View style={styles.chips}>
          <Chip
            label={t('echo.allLanguages')}
            selected={lang === null}
            onPress={() => setLang(null)}
          />
          {languages.map((row) => (
            <Chip
              key={row.lang}
              label={names.language(row.lang)}
              selected={lang === row.lang}
              onPress={() => setLang(row.lang)}
            />
          ))}
        </View>
      ) : null}

      {state === 'skeleton' ? (
        <View style={styles.loading}>
          <Skeleton height={64} />
          <Skeleton height={64} />
          <Skeleton height={64} />
        </View>
      ) : state === 'failed' ? (
        <LoadFailed onRetry={() => void cards.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(card) => card._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl {...pull} />}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            /*
             * Not while the previous term's list is still on screen: the pages
             * held then belong to the old key, and their cursor would fetch
             * the old search's next page into the new one.
             */
            if (cards.isPlaceholderData) return
            if (cards.hasNextPage && !cards.isFetchingNextPage) void cards.fetchNextPage()
          }}
          ListEmptyComponent={
            term ? (
              <EmptyState
                icon="search"
                title={t('echo.searchNoneTitle')}
                body={t('echo.searchNoneBody')}
              />
            ) : archived ? (
              <EmptyState
                icon="check-square"
                title={t('echo.archivedEmptyTitle')}
                body={t('echo.archivedEmptyBody')}
              />
            ) : (
              <EmptyState
                icon="repeat"
                title={t('echo.cardsEmptyTitle')}
                body={t('echo.cardsEmptyBody')}
              />
            )
          }
          renderItem={({ item }) =>
            /*
             * While choosing, the row is a checkbox and nothing else: the
             * swipe actions share the gesture that picks, and a row that both
             * opens a card and selects it answers the wrong one half the time.
             */
            selected ? (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected.has(item._id) }}
                onPress={() => toggleSelected(item._id)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Feather
                  name={selected.has(item._id) ? 'check-square' : 'square'}
                  size={20}
                  color={selected.has(item._id) ? colors.accent : colors.textFaint}
                />
                <View style={styles.text}>
                  <Text style={styles.front}>{item.front}</Text>
                  <Text style={styles.back}>{item.back}</Text>
                </View>
              </Pressable>
            ) : (
              <SwipeableRow
                right={[
                  {
                    id: 'edit',
                    icon: 'edit-2' as const,
                    label: t('common.edit'),
                    colour: colors.accent,
                    onAction: () => {
                      setOpenRow(null)
                      openEdit(item)
                    },
                  },
                ]}
                left={[
                  {
                    id: 'remove',
                    icon: 'trash-2' as const,
                    label: t('echo.remove'),
                    colour: colors.danger,
                    destructive: true,
                    onAction: () => {
                      setOpenRow(null)
                      void confirmRemove(item)
                    },
                  },
                ]}
                open={openRow === item._id}
                onOpenChange={(open) => setOpenRow(open ? item._id : null)}
              >
                <Pressable
                  accessibilityRole="button"
                  onPress={() => openCard(item)}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                >
                  <View style={styles.text}>
                    {/* The sentence itself. Data, not interface copy. */}
                    <Text style={styles.front}>{item.front}</Text>
                    <Text style={styles.back}>{item.back}</Text>
                    <Text style={styles.source}>{sourceLabel(item)}</Text>
                  </View>
                  <Due card={item} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('echo.cardMenu')}
                    hitSlop={8}
                    onPress={() => void openMore(item)}
                    style={({ pressed }) => (pressed ? styles.pressed : null)}
                  >
                    <Feather name="more-horizontal" size={20} color={colors.textFaint} />
                  </Pressable>
                </Pressable>
              </SwipeableRow>
            )
          }
        />
      )}
      {/*
        What the selection is for, once there is one. A bar rather than a
        header action: the count is the thing being confirmed, and it belongs
        beside the button that acts on it.
      */}
      {selected && selected.size > 0 ? (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionCount}>
            {t('echo.selectedCount', { count: selected.size })}
          </Text>
          <Button
            // Not the menu's wording: the bar acts on a selection, and a
            // sentence about one card over "6 selected" reads as a mistake.
            label={archived ? t('echo.unarchive') : t('echo.archiveCards')}
            size="small"
            variant="ink"
            loading={archive.isPending}
            onPress={() => setArchivedOn([...selected], !archived)}
            style={styles.selectionButton}
          />
        </View>
      ) : null}
    </Screen>
  )
}

/**
 * When the card comes back — `4d`, `10m`, or the word for a card already due.
 *
 * Two characters on the row and the whole sentence to a screen reader: `4d`
 * beside a card could as easily be read as its age, which is the one other
 * number a list of saved things usually carries.
 */
function Due({ card }: { card: EchoCard }) {
  const styles = useStyles()
  const t = useT()
  const time = dueInCompact(card.srs.due, { t })

  /*
   * Nothing on a card that has been put away. Its schedule is still there and
   * still says "now" — that is what makes putting it back cost nothing — but
   * saying so on a card that will never be asked is a promise the archive is
   * there to break.
   */
  if (card.archivedAt) return null

  return (
    <Text
      style={styles.due}
      accessibilityLabel={time ? t('echo.dueIn', { time }) : t('echo.dueNow')}
    >
      {time ?? t('echo.dueNow')}
    </Text>
  )
}

const useStyles = makeStyles(({ colors, spacing }) => ({
  /*
   * The settings screen's box, and its 50pt `fill` pill: the one thing on the
   * page that is not a row. Its own `paddingHorizontal` is the glyph's inset,
   * so the gutter that lines it up with the chips and the rows below has to be
   * a margin — padding there would push the glyph twice as far in.
   */
  search: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    height: 50,
    marginHorizontal: spacing.lg,
    marginTop: 2,
    paddingHorizontal: spacing.lg,
  },
  searchInput: { color: colors.text, flex: 1, fontSize: 16, height: '100%' },
  tabs: { marginTop: spacing.md, paddingHorizontal: spacing.lg },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  loading: { gap: spacing.sm, padding: spacing.lg },
  list: { paddingBottom: spacing.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: 14,
  },
  text: { flex: 1, gap: 3 },
  front: { color: colors.text, fontSize: 17, fontWeight: '700' },
  back: { color: colors.text, fontSize: 15, lineHeight: 21 },
  source: { color: colors.textFaint, fontSize: 12 },
  // Tabular figures: the column of them down the list should not shuffle
  // sideways as `9m` becomes `10m`.
  due: { color: colors.textFaint, fontSize: 13, fontVariant: ['tabular-nums'] },
  headerActions: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  headerAction: { color: colors.accent, fontSize: 16, fontWeight: '600' },
  selectionBar: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  selectionCount: { color: colors.text, flex: 1, fontSize: 15, fontWeight: '600' },
  // The button sits in a row, so it must not take the column width its
  // wrapper defaults to — see `Button`'s note on `wrap`.
  selectionButton: { width: 'auto' },
  pressed: { opacity: 0.6 },
}))
