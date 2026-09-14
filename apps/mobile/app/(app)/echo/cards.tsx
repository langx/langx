import Feather from '@expo/vector-icons/Feather'
import type { EchoCard } from '@langx/shared'
import { useState } from 'react'
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { useEchoCards, useEchoSummary, useRemoveEcho } from '../../../src/api/queries'
import { LoadFailed } from '../../../src/components/LoadFailed'
import { SwipeableRow } from '../../../src/components/SwipeableRow'
import { Chip } from '../../../src/components/ui/Chip'
import { EmptyState } from '../../../src/components/ui/EmptyState'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { useT } from '../../../src/i18n'
import { useDisplayNames } from '../../../src/i18n/displayNames'
import { usePullToRefresh } from '../../../src/hooks/usePullToRefresh'
import { chooseAlert, confirmAlert, showAlert } from '../../../src/lib/alert'
import { dedupeById } from '../../../src/lib/dedupeById'
import { listState } from '../../../src/lib/listState'
import { goBackTo } from '../../../src/lib/navigation'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { showToast } from '../../../src/lib/toast'

/** Everything kept, with the one thing this screen is for: taking it back. */
export default function EchoCardsScreen() {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const names = useDisplayNames()

  const summary = useEchoSummary()
  const [lang, setLang] = useState<string | null>(null)
  const cards = useEchoCards(lang ?? undefined)
  const removeEcho = useRemoveEcho()
  const [openRow, setOpenRow] = useState<string | null>(null)
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
      { label: t('echo.remove'), value: 'remove' as const, destructive: true },
    ])
    if (choice === 'remove') await confirmRemove(card)
  }

  function sourceLabel(card: EchoCard): string {
    if (card.source.kind === 'post') return t('echo.fromAPost')
    return names.language(card.lang)
  }

  return (
    <Screen fluid>
      <ScreenHeader title={t('echo.cards')} onBack={() => goBackTo('/(app)/(tabs)/echo')} />
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
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (cards.hasNextPage && !cards.isFetchingNextPage) void cards.fetchNextPage()
          }}
          ListEmptyComponent={
            <EmptyState
              icon="repeat"
              title={t('echo.cardsEmptyTitle')}
              body={t('echo.cardsEmptyBody')}
            />
          }
          renderItem={({ item }) => (
            <SwipeableRow
              right={[]}
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
              <View style={styles.row}>
                <View style={styles.text}>
                  {/* The sentence itself. Data, not interface copy. */}
                  <Text style={styles.front}>{item.front}</Text>
                  <Text style={styles.back}>{item.back}</Text>
                  <Text style={styles.source}>{sourceLabel(item)}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('echo.remove')}
                  hitSlop={8}
                  onPress={() => void openMore(item)}
                  style={({ pressed }) => (pressed ? styles.pressed : null)}
                >
                  <Feather name="more-horizontal" size={20} color={colors.textFaint} />
                </Pressable>
              </View>
            </SwipeableRow>
          )}
        />
      )}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, spacing }) => ({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingHorizontal: spacing.lg },
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
  pressed: { opacity: 0.6 },
}))
