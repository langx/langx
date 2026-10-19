import Feather from '@expo/vector-icons/Feather'
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import type { EchoPartnerDue } from '@langx/shared'
import { useFonts } from 'expo-font'
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { useEchoPacks, useEchoSummary } from '../api/queries'
import { EchoAboutSheet } from '../components/EchoAboutSheet'
import {
  EchoPartnerTile,
  EchoRows,
  EchoStatTile,
  EchoV3Skeleton,
  type EchoRow,
} from '../components/echo/EchoV3Parts'
import { LoadFailed } from '../components/LoadFailed'
import { BUTTON_FACE, Button } from '../components/ui/Button'
import { Chip } from '../components/ui/Chip'
import { CrossFade } from '../components/ui/CrossFade'
import { EmptyStateV3 } from '../components/ui/EmptyStateV3'
import { HeroTile } from '../components/ui/HeroTile'
import { Screen } from '../components/ui/Screen'
import { Skeleton } from '../components/ui/Skeleton'
import { useEchoOffline } from '../hooks/useEchoOffline'
import { useProfileCache, useProfileCacheStatus } from '../hooks/useProfileCache'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useScreenInteractive } from '../hooks/useScreenInteractive'
import { useDisplayNames, useLocale, useT } from '../i18n'
import { chooseAlert } from '../lib/alert'
import { authClient } from '../lib/auth-client'
import { reviewMinutes } from '../lib/echoV3'
import { compactCount, dueInCompact } from '../lib/format'
import { requireAccount } from '../lib/requireAccount'
import { DISPLAY_FONT, makeStyles, useTheme } from '../lib/theme'
import { partnerHueFor } from '../lib/theme/partnerHue'

/**
 * The redesign's Echo tab, from `V-Echo`, behind `flags.v3Home`.
 *
 * The current tab's stage was a 160pt square that was itself the button; here
 * the number is read on a `HeroTile` and the one yellow is pressed, with how
 * long it takes beside it when the summary knows this person's pace. Under
 * it the due cards kept from chats, in the hue of the person who wrote them,
 * each a review of just that person's; then the two numbers, the three rows
 * and New card. Everything the current tab did is here — the language chips,
 * the question when two languages are due, the about sheet, the cards saved
 * on the device for a tunnel — except the rotating tip line, which the
 * drawing does not have and Phase 7 replaces with coach cards.
 */
export function EchoV3Screen() {
  useScreenInteractive()
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const { locale } = useLocale()
  const names = useDisplayNames()
  const { data: session } = authClient.useSession()
  const [black] = useFonts({ Nunito_900Black })

  const summary = useEchoSummary()
  const packs = useEchoPacks()
  /** `null` is All; as on the current tab, a chip narrows the hero and its deck. */
  const [lang, setLang] = useState<string | null>(null)
  const [about, setAbout] = useState(false)
  const pull = usePullToRefresh(async () => {
    await Promise.all([summary.refetch(), packs.refetch()])
  })

  // The device's copy when the server has not answered — see `useEchoOffline`.
  const { saved } = useEchoOffline(summary.data)
  const counts = summary.data ?? saved?.summary ?? undefined
  const languages = counts?.languages ?? []
  const chosen = lang ? languages.find((row) => row.lang === lang) : undefined
  const due = lang ? (chosen?.due ?? 0) : (counts?.due ?? 0)
  const total = lang ? (chosen?.total ?? 0) : (counts?.total ?? 0)
  const minutes = reviewMinutes(due, counts?.secondsPerCard)
  const packRows = packs.data?.items ?? []
  const nextDue = summary.data?.nextDue ? dueInCompact(summary.data.nextDue, { t }) : null
  const loading = summary.isPending && !counts

  /*
   * By partner, under All only: a partner's cards are counted across every
   * language, so beside a French chip they would be a second, different
   * answer to "how many are due". Somebody learning one language — almost
   * everybody — has no chips and always sees them.
   */
  const partners: EchoPartnerDue[] = lang ? [] : (counts?.partners ?? [])
  const partnerIds = partners.map((row) => row.partnerId)
  const profiles = useProfileCache(partnerIds)
  const profileStatus = useProfileCacheStatus(partnerIds)
  // A profile that will not come — an account gone, or one that blocked this
  // one — drops its block. The cards are still in the count above and in the
  // review the yellow starts.
  const shownPartners = partners.filter((row) => profileStatus[row.partnerId] !== 'missing')

  function open(params: { lang?: string; partner?: string }): void {
    router.push({ pathname: '/(app)/echo/session', params })
  }

  /** As the current tab's: a chip is an answer, one language is not a question. */
  async function startSession(): Promise<void> {
    if (!requireAccount(session?.user, { action: 'echo' })) return
    if (lang) {
      open({ lang })
      return
    }
    const withCards = languages.filter((row) => row.due > 0)
    const only = withCards[0]
    if (!only) return
    if (withCards.length === 1) {
      open({ lang: only.lang })
      return
    }
    const picked = await chooseAlert(
      t('echo.reviewWhich'),
      undefined,
      withCards.map((row) => ({
        label: `${names.language(row.lang)} · ${t('echo.cardCount', { count: row.due })}`,
        value: row.lang,
      })),
    )
    if (picked) open({ lang: picked })
  }

  function reviewPartner(partner: string): void {
    if (!requireAccount(session?.user, { action: 'echo' })) return
    open({ partner })
  }

  function hero() {
    if (summary.isError && !counts) return <LoadFailed onRetry={() => void summary.refetch()} />

    if (due > 0) {
      return (
        <HeroTile
          tone="blue"
          value={compactCount(due, locale)}
          unit={t('echo.dueUnit', { count: due })}
          {...(minutes !== null ? { detail: t('echo.aboutMinutes', { count: minutes }) } : {})}
          accessibilityLabel={t('echo.due', { count: due })}
          action={{ label: t('home.echoStart'), icon: 'play', onPress: () => void startSession() }}
        />
      )
    }

    if (total > 0) {
      // Nothing to commit to, so no yellow: a grey block that says when.
      return (
        <View style={styles.rest} accessibilityRole="summary">
          <View style={styles.restDisc}>
            <Feather name="check" size={v3.icon.xxl} color={v3.colors.correction} />
          </View>
          <View style={styles.restText}>
            <Text style={styles.restTitle}>{t('echo.allCaughtUp')}</Text>
            {/* Only when the server has said so, as on the current tab. */}
            {nextDue ? (
              <Text style={styles.restSub}>{t('echo.nextIn', { time: nextDue })}</Text>
            ) : null}
          </View>
        </View>
      )
    }

    /*
     * A pack when there is one, and Chats when there is not — the current
     * tab's reason: a person who has just signed up has nothing in Chats to
     * keep a sentence from.
     */
    return (
      <EmptyStateV3
        art="cards"
        line={t('echo.emptyLine')}
        actionLabel={t(packRows.length > 0 ? 'echo.packsFor' : 'echo.emptyAction')}
        onAction={() =>
          packRows.length > 0
            ? router.push('/(app)/echo/packs')
            : router.push('/(app)/(tabs)/chats')
        }
      />
    )
  }

  const rows: EchoRow[] = [
    {
      key: 'packs',
      icon: 'layers',
      tint: v3.hues.lilac,
      glyph: v3.colors.ink,
      title: t('echo.packs'),
      sub: t(packRows.length > 0 ? 'echo.packsSub' : 'echo.packsEmptyTitle'),
      onPress: () => router.push('/(app)/echo/packs'),
    },
    {
      key: 'cards',
      icon: 'copy',
      tint: v3.colors.echoTint,
      glyph: v3.colors.echoText,
      title: t('echo.allCards'),
      sub: t('echo.allCardsSub'),
      onPress: () => router.push('/(app)/echo/cards'),
    },
    {
      key: 'board',
      icon: 'award',
      tint: v3.hues.tangerine,
      glyph: v3.colors.ink,
      title: t('echo.leaderboard'),
      sub: t('echo.leaderboardSub'),
      onPress: () => router.push('/(app)/echo/leaderboard'),
    },
  ]

  return (
    <Screen fluid tabbed ground={v3.colors.bg}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl {...pull} />}
      >
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, !black && styles.titleFallback]} accessibilityRole="header">
              {t('echo.title')}
            </Text>
            {/* The schedule is the feature and it is invisible; one tap explains it. */}
            <Pressable
              accessibilityRole="button"
              onPress={() => setAbout(true)}
              style={({ pressed }) => [styles.aboutPill, pressed && styles.pressed]}
            >
              <Feather name="help-circle" size={v3.icon.sm} color={v3.colors.fg} />
              <Text style={styles.aboutLabel}>{t('echo.aboutOpen')}</Text>
            </Pressable>
          </View>
          <Text style={styles.subtitle}>{t('echo.subtitle')}</Text>
        </View>

        <CrossFade ready={!loading} skeleton={<EchoV3Skeleton />}>
          <View style={styles.stack}>
            {hero()}

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

            {shownPartners.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle} accessibilityRole="header">
                  {t('echo.byPartner')}
                </Text>
                {shownPartners.map((row) => {
                  const profile = profiles[row.partnerId]
                  // The block's own height while the name is on its way.
                  if (!profile)
                    return <Skeleton key={row.partnerId} height={96} radius={v3.radius.badge} />
                  const name = profile.displayName
                  const others = row.due - 1
                  const more = [
                    row.back,
                    others > 0 ? t('echo.andMore', { count: others }) : '',
                  ].filter(Boolean)
                  return (
                    <EchoPartnerTile
                      key={row.partnerId}
                      hue={v3.hues[partnerHueFor(row.partnerId)]}
                      initial={name.trim().charAt(0).toUpperCase() || '?'}
                      name={t('echo.fromPartner', { name })}
                      due={t('echo.partnerDue', { count: row.due })}
                      line={row.front}
                      more={more.join(' · ')}
                      accessibilityLabel={t('echo.reviewFrom', { count: row.due, name })}
                      onPress={() => reviewPartner(row.partnerId)}
                    />
                  )
                })}
              </View>
            ) : null}

            {counts && counts.total > 0 ? (
              <View style={styles.stats}>
                <EchoStatTile
                  value={compactCount(counts.total, locale)}
                  label={t('echo.cardsKept', { count: counts.total })}
                  onPress={() => router.push('/(app)/echo/cards')}
                />
                <EchoStatTile
                  value={compactCount(counts.reviewedThisWeek, locale)}
                  label={t('echo.reviewedWeek', { count: counts.reviewedThisWeek })}
                  onPress={() => router.push('/(app)/echo/leaderboard')}
                />
              </View>
            ) : null}
          </View>
        </CrossFade>

        <EchoRows rows={rows} />

        <Button
          variant="secondary"
          icon="plus"
          label={t('echo.newTitle')}
          onPress={() => router.push('/(app)/echo/new')}
        />
      </ScrollView>

      <EchoAboutSheet visible={about} onClose={() => setAbout(false)} />
    </Screen>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  scroll: { flex: 1 },
  body: {
    gap: v3.space[10],
    paddingBottom: v3.space[16],
    paddingHorizontal: v3.space[12],
    paddingTop: v3.space[14],
  },
  header: { gap: v3.space[2], paddingHorizontal: v3.space[6] },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8] },
  title: { ...v3.type.title, color: v3.colors.fg, flex: 1, minWidth: 0 },
  // ExtraBold at Black's size until Black has loaded, as on Home.
  titleFallback: { fontFamily: DISPLAY_FONT },
  aboutPill: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[6],
    // 44pt on iOS and 48dp on Android, as a row-end button is.
    minHeight: BUTTON_FACE.small,
    paddingEnd: v3.space[16],
    paddingStart: v3.space[12],
  },
  aboutLabel: { ...v3.type.buttonSmall, color: v3.colors.fg },
  pressed: { opacity: 0.6 },
  subtitle: { ...v3.type.callout, color: v3.colors.muted },
  stack: { gap: v3.space[10] },
  rest: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.block,
    flexDirection: 'row',
    gap: v3.space[14],
    padding: v3.space[16],
  },
  restDisc: {
    alignItems: 'center',
    backgroundColor: v3.colors.correctionTint,
    borderRadius: v3.radius.pill,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  restText: { flex: 1, gap: v3.space[2], minWidth: 0 },
  restTitle: { ...v3.type.headline, color: v3.colors.fg },
  restSub: { ...v3.type.callout, color: v3.colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[6] },
  section: { gap: v3.space[8] },
  sectionTitle: {
    ...v3.type.headline,
    color: v3.colors.fg,
    paddingHorizontal: v3.space[6],
    paddingTop: v3.space[4],
  },
  stats: { flexDirection: 'row', gap: v3.space[8] },
}))
