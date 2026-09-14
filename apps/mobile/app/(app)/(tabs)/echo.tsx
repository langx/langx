import Feather from '@expo/vector-icons/Feather'
import { router } from 'expo-router'
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import type { EchoCard } from '@langx/shared'
import { useEchoCards, useEchoSummary } from '../../../src/api/queries'
import { Avatar } from '../../../src/components/ui/Avatar'
import { Button } from '../../../src/components/ui/Button'
import { Chip } from '../../../src/components/ui/Chip'
import { EmptyState } from '../../../src/components/ui/EmptyState'
import { LoadFailed } from '../../../src/components/LoadFailed'
import { Screen } from '../../../src/components/ui/Screen'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { useT } from '../../../src/i18n'
import { useLocale } from '../../../src/i18n/I18nProvider'
import { useDisplayNames } from '../../../src/i18n/displayNames'
import { useProfileCache } from '../../../src/hooks/useProfileCache'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { authClient } from '../../../src/lib/auth-client'
import { dedupeById } from '../../../src/lib/dedupeById'
import { relativeTimeCompact } from '../../../src/lib/format'
import { listState } from '../../../src/lib/listState'
import { usePullToRefresh } from '../../../src/hooks/usePullToRefresh'
import { requireAccount } from '../../../src/lib/requireAccount'
import { makeStyles, useTheme } from '../../../src/lib/theme'
import { useState } from 'react'

/**
 * The review tab: what is due, and where it came from.
 *
 * No packs section. Phase 1 is deliberately content-free so that nothing in
 * it can be held up by a licence, and an empty Packs heading would be a
 * promise the tab cannot keep yet.
 */
export default function EchoScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const { locale } = useLocale()
  const names = useDisplayNames()
  const { data: session } = authClient.useSession()

  const summary = useEchoSummary()
  /** `null` is All. Named languages come from the summary, never from the loaded
   *  page: a chip row that changed as you scrolled would be unusable. */
  const [lang, setLang] = useState<string | null>(null)
  const cards = useEchoCards(lang ?? undefined)
  const pull = usePullToRefresh(async () => {
    await Promise.all([summary.refetch(), cards.refetch()])
  })

  const items = dedupeById(cards.data?.pages.flatMap((page) => page.items) ?? [])
  const chats = items.filter((card) => card.source.kind === 'chat')
  const partners = useProfileCache(
    chats.map((card) => (card.source.kind === 'chat' ? card.source.partnerId : '')).filter(Boolean),
  )
  const due = summary.data?.due ?? 0
  const languages = summary.data?.languages ?? []

  const state = listState({
    isPending: cards.isPending,
    isError: cards.isError,
    itemCount: items.length,
    isPaused: cards.fetchStatus === 'paused',
  })

  function startSession(): void {
    // The one guest gate in the module, and the place the design document puts
    // it: a guest sees everything and is asked for an account at the first
    // answer, because a schedule with nowhere to live is a promise we cannot
    // keep.
    if (!requireAccount(session?.user, { action: 'echo' })) return
    router.push({
      pathname: '/(app)/echo/session',
      params: lang ? { lang } : {},
    })
  }

  function openThread(card: EchoCard): void {
    if (card.source.kind !== 'chat') return
    // `params`, never a query string built by hand: `routeLiterals.test.ts`
    // reads an interpolated literal as a wildcard.
    router.push({
      pathname: '/(app)/chat/[id]',
      params: { id: card.source.conversationId, at: card.source.messageId },
    })
  }

  return (
    <Screen fluid>
      <View style={styles.header}>
        <Text style={styles.title}>{t('echo.title')}</Text>
        <Text style={styles.due}>
          {due > 0 ? t('echo.due', { count: due }) : t('echo.allCaughtUp')}
        </Text>
        <Button label={t('echo.review')} onPress={startSession} disabled={due === 0} />
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
      </View>

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
          data={chats}
          keyExtractor={(card) => card._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl {...pull} />}
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (cards.hasNextPage && !cards.isFetchingNextPage) void cards.fetchNextPage()
          }}
          ListHeaderComponent={
            chats.length > 0 ? <Text style={styles.section}>{t('echo.fromYourChats')}</Text> : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="repeat"
              title={t('echo.emptyTitle')}
              body={t('echo.emptyBody')}
              actionLabel={t('echo.emptyAction')}
              actionVariant="secondary"
              onAction={() => router.push('/(app)/(tabs)/chats')}
            />
          }
          renderItem={({ item }) => {
            const partner =
              item.source.kind === 'chat' ? partners[item.source.partnerId] : undefined
            return (
              <Pressable
                accessibilityRole="button"
                onPress={() => openThread(item)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Avatar
                  {...(partner?.avatarUrl ? { url: partner.avatarUrl } : {})}
                  name={partner?.displayName ?? t('chat.them')}
                  {...(partner?._id ? { seed: partner._id } : {})}
                  size={40}
                />
                <View style={styles.rowText}>
                  {/* The sentence, as it was written. Never through `t()`. */}
                  <Text style={styles.front} numberOfLines={1}>
                    {item.front}
                  </Text>
                  <Text style={styles.back} numberOfLines={1}>
                    {item.back}
                  </Text>
                </View>
                <Text style={styles.when}>
                  {relativeTimeCompact(item.createdAt, { t, locale })}
                </Text>
              </Pressable>
            )
          }}
          /*
           * A footer rather than a header row, on the same argument
           * `phrases.tsx` makes: the due count is what the reader came for,
           * and a footer still renders on an empty list.
           */
          ListFooterComponent={
            <Pressable
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => router.push('/(app)/echo/cards')}
              style={styles.allLink}
            >
              <Feather name="layers" size={16} color={colors.accent} />
              <Text style={styles.allLinkText}>{t('echo.seeAllCards')}</Text>
            </Pressable>
          }
        />
      )}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  header: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  title: { ...font.title, color: colors.text },
  due: { color: colors.textMuted, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingTop: spacing.xs },
  loading: { gap: spacing.sm, padding: spacing.lg },
  list: { gap: spacing.xs, padding: spacing.lg },
  section: { color: colors.textFaint, fontSize: 13, fontWeight: '700', paddingBottom: spacing.xs },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, paddingVertical: 10 },
  pressed: { opacity: 0.6 },
  rowText: { flex: 1, gap: 2 },
  front: { color: colors.text, fontSize: 16, fontWeight: '600' },
  back: { color: colors.textMuted, fontSize: 14 },
  when: { color: colors.textFaint, fontSize: 12 },
  allLink: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingBottom: spacing.md,
    paddingTop: spacing.lg,
  },
  allLinkText: { color: colors.accent, fontSize: 15, fontWeight: '700' },
}))
