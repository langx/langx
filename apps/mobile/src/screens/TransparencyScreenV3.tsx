import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import type Feather from '@expo/vector-icons/Feather'
import {
  ACCOUNT_DELETION_GRACE_DAYS,
  type PublicLanguageCount,
  type PublicStats,
} from '@langx/shared'
import { useFonts } from 'expo-font'
import { router } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { usePublicStats } from '../api/publicStats'
import { useIsPro } from '../api/queries'
import { BarList, type BarListRow } from '../components/charts/BarList'
import { Columns } from '../components/charts/Columns'
import { LoadFailed } from '../components/LoadFailed'
import { ExternalLinkCard } from '../components/product/ExternalLinkCard'
import { FeatureCard } from '../components/product/FeatureCard'
import { ProductFaq } from '../components/product/ProductFaq'
import {
  BALANCED,
  ProductGroup,
  ProductRow,
  RowSquare,
  useStacked,
} from '../components/product/ProductGroup'
import { ProductHero } from '../components/product/ProductHero'
import { ProductScreen } from '../components/product/ProductScreen'
import { ProductSection } from '../components/product/ProductSection'
import type { ProductTone } from '../components/product/tone'
import { CountUp } from '../components/ui/CountUp'
import { SegmentedControl } from '../components/ui/SegmentedControl'
import { Skeleton } from '../components/ui/Skeleton'
import { useAppConfig } from '../hooks/useAppConfig'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useReduceMotion } from '../hooks/useReduceMotion'
import { useScreenInteractive } from '../hooks/useScreenInteractive'
import { useDisplayNames, useLocale, useT, type MessageKey } from '../i18n'
import { authClient } from '../lib/auth-client'
import { REPO_URL, type ExternalLink } from '../lib/externalLinks'
import { shouldGateGuest } from '../lib/guestGate'
import { queryFailed } from '../lib/listState'
import { openExternal } from '../lib/openExternal'
import { openPaywall } from '../lib/paywall'
import { PRODUCT_TEXT_SCALE } from '../lib/productPage'
import { requireAccount } from '../lib/requireAccount'
import { DISPLAY_FONT, makeStyles, useTheme } from '../lib/theme'
import {
  COUNTED_EVERY_MINUTES,
  countedAgo,
  formatCount,
  insightLink,
  linksFor,
  linkTitle,
  seriesOf,
  seriesTotal,
  SUPPORT_LINKS,
  TAKE_PART_LINKS,
  TRANSPARENCY_METRICS,
  totalsStep,
  transparencyQuestions,
  type TransparencyMetric,
} from '../lib/transparency'

type Glyph = keyof typeof Feather.glyphMap

/** Transparency's colour in the product family: a green, for "open". */
const TONE = 'mint' satisfies ProductTone

/** Where the paywall returns to. */
const HERE = '/(app)/transparency'

/**
 * How far a total grows with the reader's text size. Beside another total,
 * no further than its half of the phone holds (`TOTALS_TITLE_CHARS`); on its
 * own row, as far as the product's name does.
 */
const NUMERAL_SCALE = { beside: 1.2, stacked: PRODUCT_TEXT_SCALE.name } as const

/** The 30-day chart's bar area: tall enough that one quiet day still reads beside a busy one. */
const CHART_HEIGHT = 96

const SEGMENT_KEYS: Record<TransparencyMetric, MessageKey> = {
  members: 'transparency.page.dayMembers',
  messages: 'transparency.page.dayMessages',
  corrections: 'transparency.page.dayCorrections',
}

const SUM_KEYS: Record<TransparencyMetric, MessageKey> = {
  members: 'transparency.page.sumMembers',
  messages: 'transparency.page.sumMessages',
  corrections: 'transparency.page.sumCorrections',
}

/**
 * The Transparency page (plan item 8): what LangX is made of and how many
 * people use it, open to guests and accounts alike.
 *
 * It reads `GET /public/stats` and nothing else (`usePublicStats`), so it
 * can show only what the public endpoint already publishes — never anything
 * of the operator panel's, which `transparencyScreen.test.ts` holds it to.
 * Each number is named for exactly what the server counts: "Post
 * corrections" because a correction made in a chat is counted as a message,
 * and "On a streak" because a streak is only reset once it is three days
 * stale. There is no corrections-against-messages ratio: with chat
 * corrections inside the messages, any such figure would understate the
 * teaching and overstate the talking.
 *
 * When the numbers cannot be had, one `LoadFailed` stands where they would
 * be and the rest of the page stays: the code, the rules and the questions
 * are true whether or not the server answered.
 */
export function TransparencyScreenV3() {
  useScreenInteractive()
  const t = useT()
  const isPro = useIsPro()
  const { data: session } = authClient.useSession()
  const guest = shouldGateGuest(session?.user)
  const stats = usePublicStats()
  const { refreshing, onRefresh } = usePullToRefresh(stats.refetch)
  const data = stats.data
  const failed = !data && queryFailed(stats)

  const contribute = linksFor(['kitchen.contributing'])[0]
  const security = linksFor(['legal.security'])[0]
  const insight = insightLink()

  const goPro = () => {
    if (!requireAccount(session?.user, { action: 'other' })) return
    openPaywall(undefined, HERE, 'transparency')
  }

  const numbers = failed
    ? [
        // Under the section's own title, so "could not load this" says what
        // "this" is: the numbers, and nothing else on the page.
        <ProductSection key="numbers" title={t('transparency.page.numbersTitle')}>
          <LoadFailed onRetry={() => void stats.refetch()} />
        </ProductSection>,
      ]
    : [
        <ProductSection
          key="numbers"
          title={t('transparency.page.numbersTitle')}
          intro={t('transparency.page.numbersIntro', { count: COUNTED_EVERY_MINUTES })}
        >
          <Totals totals={data?.totals} />
        </ProductSection>,
        data ? <Days key="days" stats={data} /> : <ChartSkeleton key="days" />,
        data ? <Languages key="languages" stats={data} /> : null,
        data ? <Streaks key="streaks" stats={data} guest={guest} /> : null,
      ]

  return (
    <ProductScreen onRefresh={onRefresh} refreshing={refreshing}>
      <ProductHero
        key="hero"
        tone={TONE}
        mark="transparency"
        title={t('transparency.page.title')}
        body={t('transparency.page.tagline')}
        facts={[
          t('transparency.page.factOpenSource'),
          t('transparency.page.factOpenNumbers'),
          t('transparency.page.factTotals'),
        ]}
        {...(data ? { note: countedAgo(data.generatedAt, t) } : {})}
      />

      <ProductSection
        key="open"
        title={t('transparency.page.openTitle')}
        intro={t('transparency.page.openIntro')}
      >
        <ProductGroup>
          <LinkRow icon="code" title={t('transparency.page.readCode')} url={REPO_URL} />
          {contribute ? (
            <LinkRow
              icon="git-pull-request"
              title={t('transparency.page.contribute')}
              url={contribute.url}
            />
          ) : null}
          {linksFor(TAKE_PART_LINKS).map((link) => (
            <TableRow key={link.url} link={link} />
          ))}
        </ProductGroup>
      </ProductSection>

      {numbers}

      <ProductSection key="trust" title={t('transparency.page.trustTitle')}>
        <ProductGroup>
          <FeatureCard
            tone={TONE}
            icon="eye"
            title={t('transparency.page.auditTitle')}
            body={t('transparency.page.auditBody')}
          />
          {guest ? (
            <FeatureCard
              tone={TONE}
              icon="download"
              title={t('transparency.page.dataTitle')}
              body={t('transparency.page.dataBody', { count: ACCOUNT_DELETION_GRACE_DAYS })}
            />
          ) : (
            // Through to where both are: Settings › Account.
            <FeatureCard
              tone={TONE}
              icon="download"
              title={t('transparency.page.dataTitle')}
              body={t('transparency.page.dataBody', { count: ACCOUNT_DELETION_GRACE_DAYS })}
              onPress={() => router.push('/(app)/settings/account')}
            />
          )}
          <FeatureCard
            tone={TONE}
            icon="shield"
            title={t('transparency.page.boundedTitle')}
            body={t('transparency.page.boundedBody')}
          />
          <FeatureCard
            tone={TONE}
            icon="alert-triangle"
            title={t('transparency.page.securityTitle')}
            body={t('transparency.page.securityBody')}
          />
          {security ? (
            <LinkRow icon="lock" title={t('transparency.page.securityLink')} url={security.url} />
          ) : null}
        </ProductGroup>
      </ProductSection>

      <ProductSection key="support" title={t('transparency.page.supportTitle')}>
        <ProductGroup>
          {/*
            Pro first: it is what pays for the servers. A call to support,
            with no counts beside it — how many pay is on the private side of
            `docs/insight.md`'s line.
          */}
          {isPro ? (
            <FeatureCard
              tone={TONE}
              icon="star"
              title={t('transparency.page.proTitleMember')}
              body={t('transparency.page.proBodyMember')}
            />
          ) : (
            <FeatureCard
              tone={TONE}
              icon="star"
              title={t('transparency.page.proTitle')}
              body={t('transparency.page.proBody')}
              onPress={goPro}
            />
          )}
          {linksFor(SUPPORT_LINKS).map((link) => (
            <TableRow key={link.url} link={link} />
          ))}
        </ProductGroup>
      </ProductSection>

      <ProductFaq key="faq" items={transparencyQuestions(t)} />

      {insight ? (
        <ExternalLinkCard
          key="link"
          tone={TONE}
          mark="transparency"
          title={t('transparency.page.linkTitle')}
          url={insight.url}
        />
      ) : null}
    </ProductScreen>
  )
}

/**
 * A row that leaves the app, named and nothing more. No address under it:
 * the page prints no hostname but the one its link card ends on.
 */
function LinkRow({ icon, title, url }: { icon: Glyph; title: string; url: string }) {
  const t = useT()
  return (
    <ProductRow
      leading={<RowSquare tone={TONE} icon={icon} />}
      title={title}
      external
      accessibilityHint={t('productPage.opensInBrowser')}
      onPress={() => void openExternal(url)}
    />
  )
}

/** A row of `externalLinks.ts`, with the glyph and the words Our Kitchen gives it. */
function TableRow({ link }: { link: ExternalLink }) {
  const t = useT()
  return <LinkRow icon={link.icon as Glyph} title={linkTitle(link, t)} url={link.url} />
}

/**
 * The four totals, two to a row — one to a row at the larger text sizes —
 * each counted up to its number, which is written in full in the reader's
 * own way (`formatCount`). Until the answer arrives each tile has its words
 * and a placeholder where its number will be.
 */
function Totals({ totals }: { totals: PublicStats['totals'] | undefined }) {
  const t = useT()
  const { locale } = useLocale()
  const reduce = useReduceMotion()
  const stacked = useStacked()
  const styles = useStyles()
  const { v3 } = useTheme()
  const [black] = useFonts({ Nunito_900Black })

  const tiles = [
    { key: 'members', label: 'members', hint: 'membersHint', value: totals?.members },
    { key: 'messages', label: 'messages', hint: 'messagesHint', value: totals?.messages },
    {
      key: 'corrections',
      label: 'corrections',
      hint: 'correctionsHint',
      value: totals?.corrections,
    },
    { key: 'languages', label: 'languages', hint: 'languagesHint', value: totals?.languages },
  ].map((tile) => ({
    key: tile.key,
    label: t(`transparency.page.${tile.label}` as MessageKey),
    hint: t(`transparency.page.${tile.hint}` as MessageKey),
    value: tile.value,
    shown: tile.value === undefined ? '' : formatCount(tile.value, locale),
  }))

  const step = v3.type[totalsStep(tiles.map((tile) => tile.shown))]
  // Title is Nunito Black, which a screen loads for itself; until it has,
  // the ExtraBold every screen has stands in, as the hero's name does.
  const numeral = [step, styles.numeral, !black && step === v3.type.title && styles.fallback]
  const rows = stacked ? tiles.map((tile) => [tile]) : [tiles.slice(0, 2), tiles.slice(2)]

  return (
    <View style={styles.grid}>
      {rows.map((row) => (
        <View key={row.map((tile) => tile.key).join()} style={styles.gridRow}>
          {row.map((tile) => (
            <View
              key={tile.key}
              style={styles.tile}
              accessible
              accessibilityLabel={
                tile.value === undefined
                  ? tile.label
                  : t('transparency.page.totalA11y', {
                      label: tile.label,
                      amount: tile.shown,
                      hint: tile.hint,
                    })
              }
            >
              {tile.value === undefined ? (
                <Skeleton width="60%" height={step.lineHeight} />
              ) : (
                <CountUp
                  value={tile.value}
                  locale={locale}
                  reduce={reduce}
                  style={numeral}
                  maxFontSizeMultiplier={stacked ? NUMERAL_SCALE.stacked : NUMERAL_SCALE.beside}
                />
              )}
              <Text style={styles.tileLabel} maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.rowTitle}>
                {tile.label}
              </Text>
              <Text
                style={[styles.tileHint, BALANCED]}
                maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}
              >
                {tile.hint}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

/**
 * The last thirty days of one series at a time — new members, messages, or
 * post corrections — with the window's sum written over the columns, since
 * a column chart says the shape and only a number says how many.
 *
 * At the larger text sizes all three, one under another, and no switch: a
 * third of a phone holds one letter of each label there, and a choice that
 * reads "M… M… C…" is not one anybody can make.
 */
function Days({ stats }: { stats: PublicStats }) {
  const t = useT()
  const stacked = useStacked()
  // Messages first: the series with the most in it, so the chart opens on a
  // shape rather than on a row of quiet days.
  const [metric, setMetric] = useState<TransparencyMetric>('messages')
  const last = TRANSPARENCY_METRICS[TRANSPARENCY_METRICS.length - 1]

  return (
    <ProductSection title={t('transparency.page.daysTitle', { count: stats.days })}>
      {stacked
        ? TRANSPARENCY_METRICS.map((each) => (
            <DayChart key={each} stats={stats} metric={each} caption={each === last} />
          ))
        : [
            <SegmentedControl
              key="pick"
              options={TRANSPARENCY_METRICS.map((value) => ({
                value,
                label: t(SEGMENT_KEYS[value]),
              }))}
              selected={[metric]}
              onToggle={setMetric}
              accessibilityLabel={t('transparency.page.daysPick')}
            />,
            <DayChart key="chart" stats={stats} metric={metric} caption />,
          ]}
    </ProductSection>
  )
}

/** One series' card: its sum, its thirty columns, and — once a page — how to read them. */
function DayChart({
  stats,
  metric,
  caption,
}: {
  stats: PublicStats
  metric: TransparencyMetric
  caption: boolean
}) {
  const t = useT()
  const { locale } = useLocale()
  const styles = useStyles()
  const { v3 } = useTheme()

  const sum = seriesTotal(stats.daily, metric)
  const sumText = t(SUM_KEYS[metric], { count: sum, amount: formatCount(sum, locale) })

  return (
    <View style={styles.card}>
      <Text
        style={styles.sum}
        maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.rowTitle}
        // The chart below says this and more; heard once is enough.
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {sumText}
      </Text>
      <Columns
        points={seriesOf(stats.daily, metric)}
        color={v3.hues[TONE]}
        height={CHART_HEIGHT}
        accessibilityLabel={t('transparency.page.chartA11y', {
          count: stats.days,
          total: sumText,
        })}
      />
      {caption ? (
        <Text style={styles.caption} maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}>
          {t('transparency.page.daysCaption')}
        </Text>
      ) : null}
    </View>
  )
}

/** Where the chart and the lists will be, while the numbers are on their way. */
function ChartSkeleton() {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View style={styles.card}>
      <Skeleton width="40%" height={v3.type.button.lineHeight} />
      <Skeleton width="100%" height={CHART_HEIGHT} />
    </View>
  )
}

/**
 * The most-learned and most-spoken languages, named in the reader's language
 * from their codes — the English names the endpoint also sends are for the
 * English web page.
 */
function Languages({ stats }: { stats: PublicStats }) {
  const t = useT()
  const { locale } = useLocale()
  const names = useDisplayNames()
  const styles = useStyles()
  const { v3 } = useTheme()

  const rows = (list: readonly PublicLanguageCount[]): BarListRow[] =>
    list.map((item) => ({ key: item.code, label: names.language(item.code), value: item.count }))
  const lists = [
    { key: 'learning', title: t('transparency.page.learning'), rows: rows(stats.learning) },
    { key: 'native', title: t('transparency.page.native'), rows: rows(stats.native) },
  ]

  return (
    <ProductSection title={t('transparency.page.languagesTitle')}>
      {lists.map((list, index) => (
        <View key={list.key} style={styles.card}>
          <Text
            style={styles.cardTitle}
            accessibilityRole="header"
            maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.rowTitle}
          >
            {list.title}
          </Text>
          <BarList
            rows={list.rows}
            // Two hues, so the two lists are never read as one ranking.
            color={index === 0 ? v3.hues[TONE] : v3.hues.sky}
            empty={t('transparency.page.noLanguages')}
            format={(value) => formatCount(value, locale)}
            rowLabel={(row, shown) =>
              t('transparency.page.languageRow', {
                count: row.value,
                language: row.label,
                amount: shown,
              })
            }
          />
        </View>
      ))}
    </ProductSection>
  )
}

/**
 * The longest streak of anyone with an account now, and how many streaks are
 * alive. Through to the reader's own streak for an account; a guest has none.
 * Then Venus, whose page is open to everybody: her line follows
 * `flags.venusStories`, as her own page's words do, so with the videos off it
 * says they are coming rather than that they are there.
 */
function Streaks({ stats, guest }: { stats: PublicStats; guest: boolean }) {
  const t = useT()
  const { locale } = useLocale()
  const videos = useAppConfig().data?.flags.venusStories === true
  const { longest, active } = stats.streaks

  return (
    <ProductSection title={t('transparency.page.streaksTitle')}>
      <ProductGroup>
        <ProductRow
          leading={<RowSquare tone={TONE} icon="trending-up" />}
          title={t('transparency.page.longest')}
          body={t('transparency.page.longestBody')}
          value={t('transparency.page.longestValue', {
            count: longest,
            amount: formatCount(longest, locale),
          })}
        />
        <ProductRow
          leading={<RowSquare tone={TONE} icon="zap" />}
          title={t('transparency.page.active')}
          body={t('transparency.page.activeBody')}
          value={t('transparency.page.activeValue', {
            count: active,
            amount: formatCount(active, locale),
          })}
        />
        {guest ? null : (
          <ProductRow
            leading={<RowSquare tone={TONE} icon="calendar" />}
            title={t('streak.title')}
            onPress={() => router.push('/(app)/streak')}
          />
        )}
        <ProductRow
          leading={<RowSquare tone={TONE} icon="film" />}
          title={t('venus.strip.title')}
          body={t(videos ? 'transparency.page.venusBody' : 'transparency.page.venusBodySoon')}
          onPress={() => router.push('/(app)/venus')}
        />
      </ProductGroup>
    </ProductSection>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  grid: { gap: v3.space[8] },
  gridRow: { flexDirection: 'row', gap: v3.space[8] },
  tile: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    flex: 1,
    gap: v3.space[2],
    minWidth: 0,
    padding: v3.space[14],
  },
  numeral: { color: v3.colors.fg, fontVariant: ['tabular-nums'] },
  fallback: { fontFamily: DISPLAY_FONT },
  tileLabel: { ...v3.type.button, color: v3.colors.fg, marginTop: v3.space[4] },
  tileHint: { ...v3.type.caption, color: v3.colors.muted },
  card: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    gap: v3.space[12],
    padding: v3.space[14],
  },
  cardTitle: { ...v3.type.button, color: v3.colors.fg },
  sum: { ...v3.type.button, color: v3.colors.fg },
  caption: { ...v3.type.caption, color: v3.colors.muted },
}))
