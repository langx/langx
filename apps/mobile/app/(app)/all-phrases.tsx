import { hasFeature, PHRASE_SCOPES, type PhraseScope } from '@langx/shared'
import { useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { useAllPhraseCards, useEffectiveTier } from '../../src/api/queries'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { SegmentedControl } from '../../src/components/ui/SegmentedControl'
import { useProfileCache } from '../../src/hooks/useProfileCache'
import { usePullToRefresh } from '../../src/hooks/usePullToRefresh'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'
import { useT } from '../../src/i18n'
import { showAlert } from '../../src/lib/alert'
import { deckCsv } from '../../src/lib/deckCsv'
import { goBackTo } from '../../src/lib/navigation'
import { openPaywall } from '../../src/lib/paywall'
import { saveTextFile } from '../../src/lib/saveFile'
import { makeStyles } from '../../src/lib/theme'

/**
 * Every saved phrase, from every conversation, in one place.
 *
 * The deck screen answers "what did the two of us keep"; this one answers
 * "what have I kept", which is the question somebody asks when they want the
 * file rather than the list.
 *
 * Polyglot end to end, unlike the per-conversation deck: there the gate is on
 * the *file*, because the rows themselves are already on screen for free. Here
 * the read exists only to be exported, so `/me/phrases` refuses a free account
 * outright and this screen never asks. A reader who arrives anyway — a deep
 * link, a subscription that lapsed while the screen was open — gets the
 * paywall rather than an error.
 */
export default function AllPhrasesScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const [scope, setScope] = useState<PhraseScope>('mine')

  const canExport = hasFeature(useEffectiveTier(), 'deckExport')
  const deck = useAllPhraseCards(scope, canExport)
  const cards = deck.data?.items ?? []
  const pull = usePullToRefresh(() => deck.refetch())

  // The rows name the other side as an id; these are the names.
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

  return (
    <Screen fluid>
      <ScreenHeader
        title={t('chat.allPhrases')}
        onBack={() => goBackTo('/(app)/settings/account')}
        /*
         * Always drawn, unlike the deck screen's — which hides it on an empty
         * list. That is safe there and would be a trap here: a free reader's
         * list is empty by construction, so hiding the button would put the
         * paywall behind a condition that can never be true.
         */
        trailing={
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => void exportDeck()}>
            <Text style={styles.export}>{t('chat.deckExport')}</Text>
          </Pressable>
        }
      />

      <View style={styles.scope}>
        <SegmentedControl<PhraseScope>
          options={PHRASE_SCOPES.map((value) => ({
            value,
            label: t(value === 'mine' ? 'chat.phraseScopeMine' : 'chat.phraseScopeAll'),
          }))}
          selected={[scope]}
          /*
           * The scope is in the query key, so the server narrows the list and
           * the client never filters a wider one — which is what keeps the
           * file and the screen showing the same rows.
           */
          onToggle={(value) => setScope(value)}
          accessibilityLabel={t('chat.phraseScopePicker')}
        />
      </View>

      {canExport && deck.isPending ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(card) => card._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl {...pull} />}
          ListEmptyComponent={
            <EmptyState
              icon="bookmark"
              title={t('chat.allPhrases')}
              body={t('chat.allPhrasesEmpty')}
            />
          }
          renderItem={({ item }) => {
            const name = item.partnerId ? partners[item.partnerId]?.displayName : undefined
            return (
              <View style={styles.card}>
                <Text style={styles.term}>{item.term}</Text>
                <Text style={styles.meaning}>{item.meaning}</Text>
                {item.example ? <Text style={styles.example}>{item.example}</Text> : null}
                {/*
                  Where it came from, on screen rather than in the file: the CSV
                  stays three positional columns because that is what Anki maps
                  by position, and a fourth would break an existing import.
                */}
                {name ? <Text style={styles.from}>{t('chat.phraseFrom', { name })}</Text> : null}
              </View>
            )
          }}
        />
      )}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, spacing }) => ({
  export: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  scope: { paddingBottom: spacing.sm, paddingHorizontal: spacing.lg },
  loading: { paddingVertical: spacing.xl },
  list: { flexGrow: 1, gap: spacing.sm, padding: spacing.lg },
  card: { borderBottomColor: colors.border, borderBottomWidth: 1, gap: 3, paddingVertical: 14 },
  term: { color: colors.text, fontSize: 17, fontWeight: '700' },
  meaning: { color: colors.text, fontSize: 15, lineHeight: 21 },
  example: { color: colors.textMuted, fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
  from: { color: colors.textFaint, fontSize: 13, paddingTop: 2 },
}))
