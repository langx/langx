import { useLocalSearchParams } from 'expo-router'
import { FlatList, Text, View } from 'react-native'
import { usePhraseCards } from '../../src/api/queries'
import { EmptyState } from '../../src/components/ui/EmptyState'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { Skeleton } from '../../src/components/ui/Skeleton'
import { useT } from '../../src/i18n'
import { goBackTo } from '../../src/lib/navigation'
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

  return (
    <Screen fluid>
      <ScreenHeader
        title={t('chat.phraseDeck')}
        onBack={() => goBackTo(`/(app)/chat/${conversationId}`)}
      />
      {deck.isPending ? (
        <View style={styles.loading}>
          <Skeleton height={72} />
          <Skeleton height={72} />
          <Skeleton height={72} />
        </View>
      ) : (
        <FlatList
          data={deck.data?.items ?? []}
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
        />
      )}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, spacing }) => ({
  loading: { gap: spacing.sm, padding: spacing.lg },
  list: { padding: spacing.lg, gap: spacing.sm },
  card: { borderBottomColor: colors.border, borderBottomWidth: 1, gap: 3, paddingVertical: 14 },
  term: { color: colors.text, fontSize: 17, fontWeight: '700' },
  meaning: { color: colors.text, fontSize: 15, lineHeight: 21 },
  example: { color: colors.textMuted, fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
}))
