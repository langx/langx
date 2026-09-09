import { hasFeature } from '@langx/shared'
import { router, useLocalSearchParams } from 'expo-router'
import { FlatList, Pressable, Text, View } from 'react-native'
import { useEffectiveTier, usePhraseCards } from '../../src/api/queries'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { Skeleton } from '../../src/components/ui/Skeleton'
import { useT } from '../../src/i18n'
import { showAlert } from '../../src/lib/alert'
import { deckCsv } from '../../src/lib/deckCsv'
import { goBackTo } from '../../src/lib/navigation'
import { openPaywall } from '../../src/lib/paywall'
import { saveTextFile } from '../../src/lib/saveFile'
import { makeStyles } from '../../src/lib/theme'

/**
 * What a conversation has decided is worth keeping.
 *
 * Unpaged, because `conversation_term_unique` caps the deck at one row per
 * phrase and a pair with more than a screenful has a list worth scrolling
 * rather than paging.
 */
export default function PhrasesScreen() {
  const styles = useStyles()
  const t = useT()
  const { id: conversationId } = useLocalSearchParams<{ id: string }>()
  const deck = usePhraseCards(conversationId)
  /** Saving to the deck is free on every tier; taking it out is Polyglot. */
  const canExport = hasFeature(useEffectiveTier(), 'deckExport')
  const cards = deck.data?.items ?? []

  async function exportDeck(): Promise<void> {
    if (!canExport) {
      openPaywall('deckExport', `/(app)/phrases?id=${conversationId}`)
      return
    }
    const ok = await saveTextFile(deckCsv(cards), `langx-phrases-${conversationId}.csv`, {
      mimeType: 'text/csv',
      uti: 'public.comma-separated-values-text',
    })
    if (!ok) void showAlert(t('chat.deckExportFailed'))
  }

  return (
    <Screen fluid>
      <ScreenHeader
        title={t('chat.phraseDeck')}
        onBack={() => goBackTo(`/(app)/chat/${conversationId}`)}
        trailing={
          cards.length > 0 ? (
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => void exportDeck()}>
              <Text style={styles.export}>{t('chat.deckExport')}</Text>
            </Pressable>
          ) : null
        }
      />
      {deck.isPending ? (
        <View style={styles.loading}>
          <Skeleton height={72} />
          <Skeleton height={72} />
          <Skeleton height={72} />
        </View>
      ) : (
        <FlatList
          data={cards}
          keyExtractor={(card) => card._id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="bookmark"
              title={t('chat.phraseDeck')}
              body={t('chat.phraseDeckEmpty')}
            />
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.term}>{item.term}</Text>
              <Text style={styles.meaning}>{item.meaning}</Text>
              {item.example ? <Text style={styles.example}>{item.example}</Text> : null}
            </View>
          )}
          /*
           * A footer rather than a header row: this deck is what the reader
           * came for, and the way out to every deck belongs after it. A footer
           * also renders on an empty list, where the link is most useful.
           */
          ListFooterComponent={
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(app)/all-phrases')}
              style={styles.allLink}
            >
              <Text style={styles.allLinkText}>{t('chat.allPhrases')}</Text>
            </Pressable>
          }
        />
      )}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, spacing }) => ({
  export: { color: colors.accent, fontSize: 15, fontWeight: '700' },
  loading: { gap: spacing.sm, padding: spacing.lg },
  list: { padding: spacing.lg, gap: spacing.sm },
  card: { borderBottomColor: colors.border, borderBottomWidth: 1, gap: 3, paddingVertical: 14 },
  term: { color: colors.text, fontSize: 17, fontWeight: '700' },
  meaning: { color: colors.text, fontSize: 15, lineHeight: 21 },
  example: { color: colors.textMuted, fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
  allLink: { paddingTop: spacing.lg },
  allLinkText: { color: colors.accent, fontSize: 15, fontWeight: '700' },
}))
