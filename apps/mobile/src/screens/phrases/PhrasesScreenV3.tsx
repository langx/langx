import Feather from '@expo/vector-icons/Feather'
import { hasFeature, TIER_BADGES } from '@langx/shared'
import { router } from 'expo-router'
import { FlatList, Pressable, Text, View } from 'react-native'
import { useEffectiveTier, usePhraseCards } from '../../api/queries'
import { EchoHeaderV3 } from '../../components/echo/EchoHeaderV3'
import { LoadFailed } from '../../components/LoadFailed'
import { ProTagV3 } from '../../components/settings/v3/SettingsKitV3'
import { EmptyArt } from '../../components/ui/EmptyStateV3'
import { ICON_BUTTON_TARGET } from '../../components/ui/IconButton'
import { Screen } from '../../components/ui/Screen'
import { Skeleton } from '../../components/ui/Skeleton'
import { useLocale, useT } from '../../i18n'
import { showAlert } from '../../lib/alert'
import { deckCsv } from '../../lib/deckCsv'
import { queryFailed } from '../../lib/listState'
import { goBackTo } from '../../lib/navigation'
import { openPaywall } from '../../lib/paywall'
import { saveTextFile } from '../../lib/saveFile'
import { makeStyles, useTheme } from '../../lib/theme'
import { PhraseTileV3 } from './PhrasesV3Parts'

const SKELETON_ROWS = ['a', 'b', 'c']

/**
 * What a conversation has decided is worth keeping, in the redesign's look
 * (`V-Phrases`), behind `flags.v3Home`.
 *
 * `phrases.tsx`'s deck, its file and its way out to every deck. Export is a
 * grey pill beside the back chevron, with the plan's tag on it for a reader
 * whose plan does not include it — the press opens the paywall there, as
 * today — and it is hidden on an empty deck, as today.
 */
export function PhrasesScreenV3({ conversationId }: { conversationId: string }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { isRtl } = useLocale()
  const t = useT()
  const deck = usePhraseCards(conversationId)
  /** Saving to the deck is free on every tier; taking it out is Pro. */
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

  const allLink = (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push('/(app)/all-phrases')}
      style={({ pressed }) => [styles.allLink, pressed && styles.pressed]}
    >
      <View style={styles.allMark}>
        <Feather name="bookmark" size={v3.icon.lg} color={v3.colors.echoText} />
      </View>
      <View style={styles.allText}>
        <Text style={styles.allTitle}>{t('chat.allPhrases')}</Text>
        <Text style={styles.allSub}>{t('chat.allPhrasesSub')}</Text>
      </View>
      <Feather
        name={isRtl ? 'chevron-left' : 'chevron-right'}
        size={v3.icon.md}
        color={v3.colors.muted}
      />
    </Pressable>
  )

  return (
    <Screen fluid ground={v3.colors.bg}>
      <EchoHeaderV3
        title={t('chat.phraseDeck')}
        onBack={() => goBackTo(`/(app)/chat/${conversationId}`)}
        trailing={
          cards.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void exportDeck()}
              style={({ pressed }) => [styles.export, pressed && styles.pressed]}
            >
              <Feather name="download" size={v3.icon.md} color={v3.colors.fg} />
              <Text style={styles.exportLabel}>{t('chat.deckExport')}</Text>
              {!canExport && TIER_BADGES.pro ? <ProTagV3 label={TIER_BADGES.pro} /> : null}
            </Pressable>
          ) : null
        }
      />
      {deck.data ? (
        <FlatList
          data={cards}
          keyExtractor={(card) => card._id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <EmptyArt kind="cards" />
              <Text style={styles.emptyLine}>{t('chat.phraseDeckEmpty')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <PhraseTileV3 term={item.term} meaning={item.meaning} example={item.example} />
          )}
          // After the deck, and on an empty one too, where it helps most.
          ListFooterComponent={allLink}
        />
      ) : queryFailed(deck) ? (
        <LoadFailed onRetry={() => void deck.refetch()} />
      ) : (
        <View style={styles.list}>
          {SKELETON_ROWS.map((key) => (
            <Skeleton key={key} height={72} radius={v3.radius.tile} />
          ))}
        </View>
      )}
    </Screen>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  export: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[8],
    minHeight: ICON_BUTTON_TARGET,
    paddingEnd: v3.space[8],
    paddingStart: v3.space[14],
  },
  exportLabel: { ...v3.type.buttonSmall, color: v3.colors.fg, paddingEnd: v3.space[6] },
  pressed: { opacity: 0.6 },
  list: { flexGrow: 1, gap: v3.space[8], paddingBottom: v3.space[16], paddingTop: v3.space[10] },
  empty: { alignItems: 'center', gap: v3.space[16], paddingVertical: v3.space[32] },
  emptyLine: { ...v3.type.headline, color: v3.colors.fg, textAlign: 'center' },
  allLink: {
    alignItems: 'center',
    borderColor: v3.colors.line,
    borderRadius: v3.radius.tile,
    borderWidth: 2,
    flexDirection: 'row',
    gap: v3.space[12],
    marginTop: v3.space[6],
    minHeight: 64,
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[10],
  },
  allMark: {
    alignItems: 'center',
    backgroundColor: v3.colors.echoTint,
    borderRadius: v3.radius.icon,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  allText: { flex: 1, gap: 1, minWidth: 0 },
  allTitle: { ...v3.type.button, color: v3.colors.fg },
  allSub: { ...v3.type.caption, color: v3.colors.muted },
}))
