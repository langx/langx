import Feather from '@expo/vector-icons/Feather'
import type { EchoCard } from '@langx/shared'
import { router } from 'expo-router'
import { useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native'
import {
  useArchiveEchoCards,
  useEchoCards,
  useEchoSummary,
  useMe,
  useRemoveEcho,
} from '../../api/queries'
import { CardLeadV3, DuePillV3, LanguageChipsV3 } from '../../components/echo/EchoCardsV3Parts'
import { EchoHeaderV3 } from '../../components/echo/EchoHeaderV3'
import { LoadFailed } from '../../components/LoadFailed'
import { SwipeableRow } from '../../components/SwipeableRow'
import { Button } from '../../components/ui/Button'
import { EmptyStateV3 } from '../../components/ui/EmptyStateV3'
import { IconButton } from '../../components/ui/IconButton'
import { Screen } from '../../components/ui/Screen'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { Skeleton } from '../../components/ui/Skeleton'
import { useDebounced } from '../../hooks/useDebounced'
import { useProfileCache } from '../../hooks/useProfileCache'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'
import { useT } from '../../i18n'
import { useDisplayNames } from '../../i18n/displayNames'
import { chooseAlert, confirmAlert, showAlert } from '../../lib/alert'
import { track } from '../../lib/analytics'
import { dedupeById } from '../../lib/dedupeById'
import { echoAskParams } from '../../lib/echoAsk'
import { listState } from '../../lib/listState'
import { goBackTo } from '../../lib/navigation'
import { postLanguages } from '../../lib/postLanguage'
import { makeStyles, useTheme } from '../../lib/theme'
import { showToast } from '../../lib/toast'

const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e']

/**
 * Every card kept, in the redesign's look (`V-EchoCards`), behind
 * `flags.v3Home`.
 *
 * Everything `echo/cards.tsx` does, with the same requests and the same
 * words: the search, Cards | Archived, the language chips, a row that opens
 * the card, the swipe for Edit and Remove with the options menu doing the
 * same where there is no touch screen, and selecting several to archive.
 * What changes is the drawing: each row is a grey block that leads with
 * where the card came from — the partner's colour and initial for a chat's,
 * a glyph for the rest — and New card is a labelled pill rather than a bare
 * plus.
 */
export function EchoCardsScreenV3() {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const names = useDisplayNames()

  const summary = useEchoSummary()
  const [lang, setLang] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  // Debounced, for `echo/cards.tsx`'s reason: the empty state reads it too.
  const term = useDebounced(query.trim())
  const [archived, setArchived] = useState(false)
  const cards = useEchoCards(lang ?? undefined, term || undefined, archived)
  const removeEcho = useRemoveEcho()
  const archive = useArchiveEchoCards()
  const me = useMe()
  const postable = useMemo(() => postLanguages(me.data?.learning), [me.data])
  const [openRow, setOpenRow] = useState<string | null>(null)
  /** `null` is not selecting; an empty set is selecting nothing yet. */
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

  // The names behind the chat cards' initials and their "From Anna".
  const profiles = useProfileCache(
    items.flatMap((card) => (card.source.kind === 'chat' ? [card.source.partnerId] : [])),
  )

  /*
   * How many cards are in rotation, beside the title — only where the
   * summary answers the question the list is showing: the rotation, not the
   * archive (archived cards count nowhere in it) and not a search.
   */
  const shownTotal =
    archived || term || !summary.data
      ? null
      : lang
        ? (languages.find((row) => row.lang === lang)?.total ?? null)
        : summary.data.total

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

  /** The swipe's actions and more, for the web, where there is no swipe. */
  async function openMore(card: EchoCard): Promise<void> {
    const post = echoAskParams(card, postable)
    const choice = await chooseAlert(t('echo.cards'), undefined, [
      { label: t('common.edit'), value: 'edit' as const },
      ...(post ? [{ label: t('echo.postToFeed'), value: 'post' as const }] : []),
      {
        label: archived ? t('echo.unarchive') : t('echo.archiveCard'),
        value: 'archive' as const,
      },
      { label: t('echo.selectCards'), value: 'select' as const },
      { label: t('echo.remove'), value: 'remove' as const, destructive: true },
    ])
    if (choice === 'edit') openEdit(card)
    if (choice === 'post' && post) {
      track({ name: 'echo_ask_opened', properties: { kind: 'pronunciation', entry: 'cards' } })
      router.push({ pathname: '/(app)/compose', params: post })
    }
    if (choice === 'archive') setArchivedOn([card._id], !archived)
    if (choice === 'select') setSelected(new Set([card._id]))
    if (choice === 'remove') await confirmRemove(card)
  }

  function openEdit(card: EchoCard): void {
    router.push({ pathname: '/(app)/echo/edit', params: { id: card._id } })
  }

  function openCard(card: EchoCard): void {
    router.push({ pathname: '/(app)/echo/card/[id]', params: { id: card._id } })
  }

  function partnerName(card: EchoCard): string | undefined {
    return card.source.kind === 'chat' ? profiles[card.source.partnerId]?.displayName : undefined
  }

  /** The current list's words, and "From Anna" once the name has arrived. */
  function sourceLabel(card: EchoCard): string {
    if (card.source.kind === 'post') return t('echo.fromAPost')
    if (card.source.kind === 'manual') return t('echo.fromYourself')
    const name = partnerName(card)
    if (name) return t('echo.fromPartner', { name })
    return names.language(card.lang)
  }

  function initialOf(card: EchoCard): string {
    return partnerName(card)?.trim().charAt(0).toUpperCase() || '·'
  }

  function empty() {
    if (term) {
      return (
        <EmptyStateV3
          art="cards"
          line={t('echo.searchNoneTitle')}
          actionLabel={t('common.clear')}
          actionVariant="secondary"
          onAction={() => setQuery('')}
        />
      )
    }
    if (archived) {
      return (
        <View style={styles.archivedEmpty}>
          <Text style={styles.emptyTitle}>{t('echo.archivedEmptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('echo.archivedEmptyBody')}</Text>
        </View>
      )
    }
    return (
      <EmptyStateV3
        art="cards"
        line={t('echo.cardsEmptyTitle')}
        actionLabel={t('echo.newTitle')}
        onAction={() => router.push('/(app)/echo/new')}
      />
    )
  }

  return (
    <Screen fluid ground={v3.colors.bg}>
      <EchoHeaderV3
        title={t('echo.cards')}
        onBack={() => goBackTo('/(app)/(tabs)/echo')}
        {...(shownTotal !== null && !selected
          ? { meta: t('echo.cardCount', { count: shownTotal }) }
          : {})}
        trailing={
          selected ? (
            <Button
              label={t('common.done')}
              variant="secondary"
              size="small"
              onPress={() => setSelected(null)}
              style={styles.headerButton}
            />
          ) : (
            <>
              {items.length > 0 ? (
                <IconButton
                  icon="check-square"
                  look="surface"
                  iconSize={v3.icon.lg}
                  accessibilityLabel={t('echo.selectCards')}
                  onPress={() => setSelected(new Set())}
                />
              ) : null}
              <Button
                label={t('echo.newTitle')}
                icon="plus"
                variant="ink"
                size="small"
                onPress={() => router.push('/(app)/echo/new')}
                style={styles.headerButton}
              />
            </>
          )
        }
      />

      <View style={styles.controls}>
        <View style={styles.search}>
          <Feather name="search" size={v3.icon.lg} color={v3.colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('echo.searchPlaceholder')}
            placeholderTextColor={v3.colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            accessibilityLabel={t('echo.searchPlaceholder')}
            style={styles.searchInput}
          />
        </View>

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

        {languages.length > 1 ? (
          <LanguageChipsV3
            allLabel={t('echo.allLanguages')}
            options={languages.map((row) => ({
              value: row.lang,
              label: names.language(row.lang),
            }))}
            selected={lang}
            onSelect={(value) => setLang(value)}
          />
        ) : null}
      </View>

      {state === 'skeleton' ? (
        <View style={styles.list}>
          {SKELETON_ROWS.map((key) => (
            <Skeleton key={key} height={88} radius={v3.radius.tile} />
          ))}
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
            // Not while the previous term's pages are still on screen; see
            // `echo/cards.tsx`.
            if (cards.isPlaceholderData) return
            if (cards.hasNextPage && !cards.isFetchingNextPage) void cards.fetchNextPage()
          }}
          ListEmptyComponent={empty()}
          renderItem={({ item }) =>
            // While choosing, the row is a checkbox and nothing else.
            selected ? (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected.has(item._id) }}
                onPress={() => toggleSelected(item._id)}
                style={({ pressed }) => [
                  styles.row,
                  selected.has(item._id) && styles.rowChosen,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.check, selected.has(item._id) && styles.checkOn]}>
                  {selected.has(item._id) ? (
                    <Feather name="check" size={v3.icon.sm} color={v3.colors.onBlue} />
                  ) : null}
                </View>
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
                    colour: v3.colors.blue,
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
                    colour: v3.colors.danger,
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
                <View style={styles.row}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => openCard(item)}
                    style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
                  >
                    <CardLeadV3 card={item} initial={initialOf(item)} />
                    <View style={styles.text}>
                      {/* The sentence itself. Data, not interface copy. */}
                      <Text style={styles.front}>{item.front}</Text>
                      <Text style={styles.back}>{item.back}</Text>
                      <View style={styles.meta}>
                        <Text style={styles.source} numberOfLines={1}>
                          {sourceLabel(item)}
                        </Text>
                        <DuePillV3 card={item} />
                      </View>
                    </View>
                  </Pressable>
                  <IconButton
                    icon="more-horizontal"
                    iconSize={v3.icon.lg}
                    color={v3.colors.muted}
                    accessibilityLabel={t('echo.cardMenu')}
                    onPress={() => void openMore(item)}
                  />
                </View>
              </SwipeableRow>
            )
          }
        />
      )}

      {selected && selected.size > 0 ? (
        <View style={styles.selectionBar}>
          <Text style={styles.selectionCount}>
            {t('echo.selectedCount', { count: selected.size })}
          </Text>
          <Button
            label={archived ? t('echo.unarchive') : t('echo.archiveCards')}
            size="small"
            variant="ink"
            loading={archive.isPending}
            onPress={() => setArchivedOn([...selected], !archived)}
            style={styles.headerButton}
          />
        </View>
      ) : null}
    </Screen>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  // The button sits in a row, so it must not take the column width its
  // wrapper defaults to — see `Button`'s note on `wrap`.
  headerButton: { width: 'auto' },
  controls: { gap: v3.space[10], paddingTop: v3.space[4] },
  search: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[10],
    height: 56,
    paddingHorizontal: v3.space[16],
  },
  searchInput: { ...v3.type.body, color: v3.colors.fg, flex: 1, height: '100%' },
  list: { gap: v3.space[8], paddingBottom: v3.space[16], paddingTop: v3.space[12] },
  row: {
    alignItems: 'flex-start',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 76,
    paddingEnd: v3.space[4],
    paddingStart: v3.space[12],
    paddingVertical: v3.space[12],
  },
  rowChosen: { backgroundColor: v3.colors.echoTint },
  rowMain: { alignItems: 'flex-start', flex: 1, flexDirection: 'row', gap: v3.space[12] },
  text: { flex: 1, gap: v3.space[2], minWidth: 0 },
  front: { ...v3.type.button, color: v3.colors.fg },
  back: { ...v3.type.callout, color: v3.colors.fg },
  meta: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: v3.space[8],
    marginTop: v3.space[2],
  },
  source: { ...v3.type.caption, color: v3.colors.muted, flexShrink: 1 },
  check: {
    alignItems: 'center',
    borderColor: v3.colors.muted,
    borderRadius: v3.radius.icon,
    borderWidth: 2,
    height: 28,
    justifyContent: 'center',
    marginTop: v3.space[2],
    width: 28,
  },
  checkOn: { backgroundColor: v3.colors.blue, borderColor: v3.colors.blue },
  archivedEmpty: { gap: v3.space[8], paddingHorizontal: v3.space[16], paddingVertical: 64 },
  emptyTitle: { ...v3.type.headline, color: v3.colors.fg, textAlign: 'center' },
  emptyBody: { ...v3.type.callout, color: v3.colors.muted, textAlign: 'center' },
  selectionBar: {
    alignItems: 'center',
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: v3.space[12],
    paddingVertical: v3.space[10],
  },
  selectionCount: { ...v3.type.button, color: v3.colors.fg, flex: 1 },
  pressed: { opacity: 0.6 },
}))
