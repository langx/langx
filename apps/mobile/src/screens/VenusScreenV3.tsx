import { COSMETICS, TOKEN_RULES } from '@langx/shared'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Text, View } from 'react-native'
import { useTokens } from '../api/queries'
import { ExternalLinkCard } from '../components/product/ExternalLinkCard'
import { FeatureCard } from '../components/product/FeatureCard'
import { ProductFaq, type ProductQuestion } from '../components/product/ProductFaq'
import {
  BALANCED,
  ProductGroup,
  ProductRow,
  ROW_SQUARE,
  useGlyphScale,
} from '../components/product/ProductGroup'
import { ProductHero } from '../components/product/ProductHero'
import { ProductScreen } from '../components/product/ProductScreen'
import { ProductSection } from '../components/product/ProductSection'
import { useToneColors } from '../components/product/tone'
import { FlameGlyph } from '../components/ui/StreakFlame'
import { VenusArchiveGrid } from '../components/venus/VenusDays'
import { useWhatsAppStickerPack, WhatsAppStickerButton } from '../components/WhatsAppStickerButton'
import { useAppConfig } from '../hooks/useAppConfig'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import { useScreenInteractive } from '../hooks/useScreenInteractive'
import { useVenusArchive, type VenusArchiveView } from '../hooks/useVenusArchive'
import { VENUS_MEDIA_URL } from '../hooks/useVenusStory'
import { useT } from '../i18n'
import type { TranslateFn } from '../i18n/runtime'
import { authClient } from '../lib/auth-client'
import { VENUS_PAGE_URL } from '../lib/externalLinks'
import { shouldGateGuest } from '../lib/guestGate'
import { nextStreakMilestone } from '../lib/homePlan'
import { openStickerPack } from '../lib/navigation'
import { PRODUCT_TEXT_SCALE } from '../lib/productPage'
import { stickerAsset, stickerNameKey } from '../lib/stickerAssets'
import { makeStyles, useTheme } from '../lib/theme'
import { requestVenusClip, venusIntroFilm, type VenusStreak } from '../lib/venusStory'
import { WHATSAPP_PACKS } from '../lib/whatsappStickers'

const PACK_ID = 'stickers.venus'
const PACK = COSMETICS.find((cosmetic) => cosmetic.id === PACK_ID)
const STICKERS: readonly string[] = PACK?.stickers ?? []

/**
 * Who she is, in her own stickers' names — "Diva in a hoodie", "Hiding in a
 * box" — and nothing else. The page says what the app already says about her
 * and invents no more: these four are the ones that are a character rather
 * than a reply. Ids the pack no longer has are dropped, not drawn empty.
 */
const PERSONALITY = ['diva', 'boxhide', 'zoomies', 'meantit'].filter((id) => STICKERS.includes(id))

/** The pack's preview: its first, wordless, stickers — the ones that read in any chat. */
const PREVIEW = STICKERS.slice(0, 6)

/**
 * Venus's page (plan item 3, `docs/plans/products-and-transparency.md`): who
 * she is, what she does for a streak, her videos, her stickers, and the
 * questions people ask about her. One of the four product pages, on their
 * shared frame (`components/product/`), in her sky.
 *
 * Shown to everybody. The videos are behind `flags.venusStories`, so the
 * words about them follow the flag — with it off they are "coming soon", as
 * langx.io/venus says — and the parts that play something (the introduction,
 * the archive) are drawn only when the bucket holds a video in the app's
 * language. A guest gets the page without the live streak or the videos: no
 * streak to show, and the player does not open for one.
 */
export function VenusScreenV3() {
  useScreenInteractive()
  const { data: session } = authClient.useSession()
  return shouldGateGuest(session?.user) ? <VenusPage /> : <MemberVenus />
}

function MemberVenus() {
  const tokens = useTokens()
  const archive = useVenusArchive()
  const pull = usePullToRefresh(() => tokens.refetch())
  return (
    <VenusPage
      streak={tokens.data?.streak}
      archive={archive}
      onRefresh={pull.onRefresh}
      refreshing={pull.refreshing}
    />
  )
}

function VenusPage({
  streak,
  archive = null,
  onRefresh,
  refreshing,
}: {
  /** The account's streak, live; absent for a guest and while it loads. */
  streak?: VenusStreak | undefined
  archive?: VenusArchiveView | null
  onRefresh?: () => void
  refreshing?: boolean
}) {
  const t = useT()
  const flags = useAppConfig().data?.flags
  const videos = flags?.venusStories === true
  const whatsApp = flags?.whatsappStickers === true
  const whatsAppButton = useWhatsAppStickerPack(PACK_ID) !== undefined
  const count = STICKERS.length
  const intro = archive?.days.find((day) => day.day === 1)?.clip ?? null

  return (
    <ProductScreen {...(onRefresh ? { onRefresh, refreshing: refreshing ?? false } : {})}>
      <ProductHero
        key="hero"
        tone="sky"
        mark="venus"
        title={t('venus.page.title')}
        body={t('venus.page.tagline')}
        facts={[
          videos ? t('venus.page.factVideos') : t('venus.page.factVideosSoon'),
          t('stickerPack.count', { count }),
          t('venus.page.factFree'),
        ]}
        {...(intro
          ? {
              action: {
                label: t('venus.page.watchIntro'),
                icon: 'play' as const,
                onPress: () => requestVenusClip(venusIntroFilm(intro, VENUS_MEDIA_URL)),
              },
            }
          : {})}
      />

      <ProductSection key="who" title={t('venus.page.whoTitle')} intro={t('venus.page.whoBody')}>
        <Personality />
      </ProductSection>

      <ProductSection key="does" title={t('venus.page.doesTitle')}>
        <ProductGroup>
          {videos ? (
            <>
              <FeatureCard
                tone="sky"
                icon="film"
                title={t('venus.page.videosTitle')}
                body={t('venus.page.videosBody')}
              />
              <FeatureCard
                tone="sky"
                icon="rotate-ccw"
                title={t('venus.page.comebackTitle')}
                body={t('venus.page.comebackBody')}
              />
              <FeatureCard
                tone="sky"
                icon="unlock"
                title={t('venus.page.keepTitle')}
                body={t('venus.page.keepBody')}
              />
            </>
          ) : (
            <FeatureCard
              tone="sky"
              icon="film"
              title={t('venus.page.videosSoonTitle')}
              body={t('venus.page.videosSoonBody')}
            />
          )}
          {streak ? <StreakRow streak={streak} /> : null}
        </ProductGroup>
      </ProductSection>

      {archive ? (
        <ProductSection
          key="archive"
          title={t('venus.page.archiveTitle')}
          intro={t('venus.page.archiveIntro')}
        >
          <VenusArchiveGrid archive={archive} />
        </ProductSection>
      ) : null}

      <ProductSection
        key="stickers"
        title={t('venus.page.stickersTitle')}
        intro={t('venus.page.stickersIntro', { count })}
      >
        <ProductGroup>
          <StickerPreview />
          <ProductRow title={t('stickerPack.seePack')} onPress={() => openStickerPack(PACK_ID)} />
        </ProductGroup>
        {/* Draws itself only where the flag, the platform and WhatsApp allow. */}
        <WhatsAppStickerButton packId={PACK_ID} />
      </ProductSection>

      <ProductFaq
        key="faq"
        items={questions(t, {
          videos,
          playable: archive !== null,
          whatsApp,
          whatsAppButton,
          count,
        })}
      />

      <ExternalLinkCard
        key="link"
        tone="sky"
        mark="venus"
        title={t('venus.page.linkTitle')}
        url={VENUS_PAGE_URL}
      />
    </ProductScreen>
  )
}

/**
 * The questions, checked against the code they describe. With the videos off
 * only the ones that are true without them: when they come, and the stickers.
 */
function questions(
  t: TranslateFn,
  {
    videos,
    playable,
    whatsApp,
    whatsAppButton,
    count,
  }: {
    videos: boolean
    /** The archive is drawn: the bucket holds her days in the app's language. */
    playable: boolean
    whatsApp: boolean
    /** "Add to WhatsApp" is on this page, by the button's own test. */
    whatsAppButton: boolean
    count: number
  },
): ProductQuestion[] {
  const whatsAppCount = WHATSAPP_PACKS[PACK_ID]?.stickers.length ?? 0
  // Three answers, because the button draws only on a phone with WhatsApp:
  // pointing at it from the web, where it never draws, would be false, and
  // so would "not from the app" while the phone app does it.
  const otherApps: ProductQuestion = {
    key: 'otherApps',
    question: t('venus.page.qOtherApps'),
    answer: whatsAppButton
      ? t('venus.page.aOtherAppsWhatsApp', { count: whatsAppCount })
      : whatsApp && whatsAppCount > 0
        ? t('venus.page.aOtherAppsWhatsAppPhone', { count: whatsAppCount })
        : t('venus.page.aOtherAppsChats'),
  }
  const free: ProductQuestion = {
    key: 'free',
    question: t('venus.page.qFree'),
    answer: t('venus.page.aFree', { count }),
  }
  const who: ProductQuestion = {
    key: 'who',
    question: t('venus.page.qWho'),
    answer: t('venus.page.aWho'),
  }
  if (!videos) {
    return [
      who,
      { key: 'when', question: t('venus.page.qWhenSoon'), answer: t('venus.page.aWhenSoon') },
      free,
      otherApps,
    ]
  }
  return [
    who,
    { key: 'when', question: t('venus.page.qWhen'), answer: t('venus.page.aWhen') },
    { key: 'missed', question: t('venus.page.qMissed'), answer: t('venus.page.aMissed') },
    { key: 'breaks', question: t('venus.page.qBreaks'), answer: t('venus.page.aBreaks') },
    { key: 'share', question: t('venus.page.qShare'), answer: t('venus.page.aShare') },
    // Only where a video in the app's language is there to play: the flag
    // alone does not say the bucket holds this locale.
    ...(playable
      ? [
          {
            key: 'language',
            question: t('venus.page.qLanguage'),
            answer: t('venus.page.aLanguage'),
          },
        ]
      : []),
    free,
    otherApps,
  ]
}

/**
 * The person's streak and the next milestone it is climbing to, live, as a
 * way through to the streak page — the thing Venus is there for.
 */
function StreakRow({ streak }: { streak: VenusStreak }) {
  const t = useT()
  const current = streak.current
  if (current < 1) {
    return (
      <ProductRow
        leading={<FlameSquare />}
        title={t('streak.noStreakTitle')}
        body={t('streak.noStreakBody')}
        onPress={() => router.push('/(app)/streak')}
      />
    )
  }
  const next = nextStreakMilestone(current, TOKEN_RULES.streakMilestones)
  return (
    <ProductRow
      leading={<FlameSquare />}
      title={t('home.streakDays', { count: current })}
      body={
        next
          ? t('home.streakNext', { count: next.day - current, day: next.day })
          : t('streak.heroLongest', { count: streak.longest })
      }
      onPress={() => router.push('/(app)/streak')}
    />
  )
}

/** The streak's flame on its tangerine, at a row square's size. */
function FlameSquare() {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { ground, on } = useToneColors('tangerine')
  const scale = useGlyphScale()
  const side = ROW_SQUARE * scale
  return (
    <View
      style={[
        styles.square,
        {
          backgroundColor: ground,
          borderRadius: v3.radius.icon * scale,
          height: side,
          width: side,
        },
      ]}
    >
      <FlameGlyph size={Math.round(v3.icon.lg * scale)} color={on} />
    </View>
  )
}

/** Four of her stickers, each over its own name. */
function Personality() {
  const t = useT()
  const styles = useStyles()
  return (
    <View style={styles.personality}>
      {PERSONALITY.map((id) => (
        <View key={id} style={styles.trait} accessible accessibilityRole="text">
          <Image
            source={stickerAsset(PACK_ID, id) ?? null}
            style={styles.traitPicture}
            contentFit="contain"
            accessible={false}
          />
          <Text
            style={[styles.traitName, BALANCED]}
            maxFontSizeMultiplier={PRODUCT_TEXT_SCALE.text}
            textBreakStrategy="balanced"
            lineBreakStrategyIOS="push-out"
          >
            {t(stickerNameKey(PACK_ID, id))}
          </Text>
        </View>
      ))}
    </View>
  )
}

/** A row of the pack's stickers over "See the pack". Pictures only: the row under says it. */
function StickerPreview() {
  const styles = useStyles()
  return (
    <View
      style={styles.preview}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {PREVIEW.map((id) => (
        <Image
          key={id}
          source={stickerAsset(PACK_ID, id) ?? null}
          style={styles.previewPicture}
          contentFit="contain"
        />
      ))}
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  square: { alignItems: 'center', justifyContent: 'center' },
  // Two by two: a name such as "I meant to do that" needs half the block to
  // stay on two lines, and four across left it a word a line.
  personality: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.tile,
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: v3.space[8],
    paddingVertical: v3.space[12],
    rowGap: v3.space[12],
  },
  trait: { alignItems: 'center', gap: v3.space[6], paddingHorizontal: v3.space[6], width: '50%' },
  traitPicture: { aspectRatio: 1, width: '62%' },
  traitName: { ...v3.type.callout, color: v3.colors.fg, fontWeight: '600', textAlign: 'center' },
  preview: {
    flexDirection: 'row',
    gap: v3.space[6],
    paddingHorizontal: v3.space[12],
    paddingVertical: v3.space[12],
  },
  previewPicture: { aspectRatio: 1, flex: 1 },
}))
