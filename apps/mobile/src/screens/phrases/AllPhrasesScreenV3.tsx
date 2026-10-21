import { hasFeature, PHRASE_SCOPES, type PhraseScope } from '@langx/shared'
import { router } from 'expo-router'
import { useState } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native'
import { useAllPhraseCards, useEffectiveTier } from '../../api/queries'
import { EchoHeaderV3 } from '../../components/echo/EchoHeaderV3'
import { LoadFailed } from '../../components/LoadFailed'
import { Button } from '../../components/ui/Button'
import { EmptyStateV3 } from '../../components/ui/EmptyStateV3'
import { Screen } from '../../components/ui/Screen'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { useProfileCache } from '../../hooks/useProfileCache'
import { usePullToRefresh } from '../../hooks/usePullToRefresh'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useT } from '../../i18n'
import { showAlert } from '../../lib/alert'
import { deckCsv } from '../../lib/deckCsv'
import { queryFailed } from '../../lib/listState'
import { goBackTo } from '../../lib/navigation'
import { openPaywall } from '../../lib/paywall'
import { saveTextFile } from '../../lib/saveFile'
import { makeStyles, useTheme } from '../../lib/theme'
import { PhraseTileV3 } from './PhrasesV3Parts'

/**
 * Every saved phrase, in the redesign's look (`V-AllPhrases`), behind
 * `flags.v3Home`.
 *
 * `all-phrases.tsx`'s list and its file: Mine | Everything narrowed by the
 * server, the rows with whose chat each came from, and Export — the page's
 * one commit, so the yellow at the foot, always drawn because a free
 * reader's list is empty by construction and Export is where the paywall is.
 */
export function AllPhrasesScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const [scope, setScope] = useState<PhraseScope>('mine')

  const canExport = hasFeature(useEffectiveTier(), 'deckExport')
  const deck = useAllPhraseCards(scope, canExport)
  const cards = deck.data?.items ?? []
  const pull = usePullToRefresh(() => deck.refetch())

  const partners = useProfileCache(
    cards.flatMap((card) => (card.partnerId ? [card.partnerId] : [])),
  )

  async function exportDeck(): Promise<void> {
    if (!canExport) {
      openPaywall('deckExport', '/(app)/all-phrases')
      return
    }
    const ok = await saveTextFile(deckCsv(cards), 'langx-phrases-all.csv', {
      mimeType: 'text/csv',
      uti: 'public.comma-separated-values-text',
    })
    if (!ok) void showAlert(t('chat.deckExportFailed'))
  }

  function list() {
    if (canExport && !deck.data) {
      if (queryFailed(deck)) return <LoadFailed onRetry={() => void deck.refetch()} />
      return <ActivityIndicator style={styles.loading} />
    }
    return (
      <FlatList
        data={cards}
        keyExtractor={(card) => card._id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl {...pull} />}
        ListEmptyComponent={
          <EmptyStateV3
            art="cards"
            line={t('chat.allPhrasesEmpty')}
            actionLabel={t('echo.emptyAction')}
            actionVariant="secondary"
            onAction={() => router.push('/(app)/(tabs)/chats')}
          />
        }
        renderItem={({ item }) => {
          const name = item.partnerId ? partners[item.partnerId]?.displayName : undefined
          return (
            <PhraseTileV3
              term={item.term}
              meaning={item.meaning}
              example={item.example}
              // On screen rather than in the file: the CSV stays three
              // positional columns, which is what Anki maps by position.
              from={
                name && item.partnerId
                  ? { partnerId: item.partnerId, name, label: t('chat.phraseFrom', { name }) }
                  : undefined
              }
            />
          )
        }}
      />
    )
  }

  return (
    <Screen fluid ground={v3.colors.bg}>
      <EchoHeaderV3
        title={t('chat.allPhrases')}
        onBack={() => goBackTo('/(app)/settings/account')}
      />
      <SegmentedControl<PhraseScope>
        options={PHRASE_SCOPES.map((value) => ({
          value,
          label: t(value === 'mine' ? 'chat.phraseScopeMine' : 'chat.phraseScopeAll'),
        }))}
        selected={[scope]}
        // The scope is in the query key: the server narrows, so the file and
        // the screen always hold the same rows.
        onToggle={(value) => setScope(value)}
        accessibilityLabel={t('chat.phraseScopePicker')}
      />
      {list()}
      <View style={styles.foot}>
        <Button
          label={
            cards.length > 0
              ? t('chat.deckExportCount', { count: cards.length })
              : t('chat.deckExport')
          }
          icon="download"
          onPress={() => void exportDeck()}
        />
        <Text style={styles.footNote}>{t('chat.deckExportNote')}</Text>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  loading: { flex: 1, paddingVertical: v3.space[32] },
  list: { flexGrow: 1, gap: v3.space[8], paddingBottom: v3.space[14], paddingTop: v3.space[10] },
  foot: {
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    gap: v3.space[8],
    paddingBottom: v3.space[8],
    paddingTop: v3.space[10],
  },
  footNote: { ...v3.type.caption, color: v3.colors.muted, textAlign: 'center' },
}))
