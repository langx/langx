import Feather from '@expo/vector-icons/Feather'
import {
  PLAN_FEATURES,
  PLAN_LIMITS,
  PRO_BENEFITS,
  planChangeFor,
  platformOfStore,
  type BillingPeriod,
  type HeldPlan,
  type PlanChange,
  type PlanFeature,
  type ProBenefit,
  TIER_BADGES,
  TIER_NAMES,
} from '@langx/shared'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import { useEffectiveTier, useMe, useQuota, useRefreshEntitlement } from '../../src/api/queries'
import { GiftCodeEntry } from '../../src/components/GiftCodeEntry'
import { PlanOption } from '../../src/components/paywall/PlanOption'
import { Reveal } from '../../src/components/paywall/Reveal'
import { TrialTimeline, type TrialStep } from '../../src/components/paywall/TrialTimeline'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { Skeleton } from '../../src/components/ui/Skeleton'
import { track } from '../../src/lib/analytics'
import { PAYWALL_SOURCES, type PaywallSource } from '../../src/lib/analyticsEvents'
import { selection } from '../../src/lib/haptics'
import { goBackTo } from '../../src/lib/navigation'
import { perMonthPriceString } from '../../src/lib/perMonthPrice'
import { yearlyFreeMonths, yearlySavingPercent } from '../../src/lib/planSaving'
import {
  getOffers,
  isPurchasesAvailable,
  purchaseOffer,
  restorePurchases,
  type PurchaseOffer,
} from '../../src/lib/purchases'
import { DISPLAY_FONT, makeStyles, useTheme } from '../../src/lib/theme'
import { APPLE_EULA_URL, PRIVACY_URL, TERMS_URL } from '../../src/lib/externalLinks'
import { useLocale, useT, type MessageKey } from '../../src/i18n'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

const PERIOD_LABEL: Record<BillingPeriod, MessageKey> = {
  monthly: 'paywall.monthly',
  yearly: 'paywall.yearly',
  lifetime: 'paywall.lifetime',
}

/**
 * The order the plan cards come in. Yearly leads and is picked when the screen
 * opens: it is the one the saving is measured on. Lifetime last, if a store
 * ever returns one.
 */
const PERIOD_ORDER: readonly BillingPeriod[] = ['yearly', 'monthly', 'lifetime']

/**
 * The period as it reads after a price — "a year", not "Yearly" — for the
 * price row and the trial caption. A separate key rather than the label
 * lower-cased: case is not a string operation in every locale, and the two are
 * different words in most of them.
 */
const PERIOD_PHRASE: Record<BillingPeriod, MessageKey> = {
  monthly: 'paywall.perMonth',
  yearly: 'paywall.perYear',
  lifetime: 'paywall.perLifetime',
}

/**
 * How long the hero waits for the store before it shows anyway.
 *
 * The headline depends on the store's answer — "Try Pro free for a week" is
 * only true when a trial came back — so the page holds its entrance until the
 * offers arrive rather than opening on one headline and swapping to another.
 * RevenueCat usually answers from its cache in a fraction of this; a store
 * that has not answered by then gets the plain headline and the skeletons.
 */
const STORE_WAIT_MS = 1000

/**
 * Copy for every benefit in `PRO_BENEFITS`, keyed by it.
 *
 * `Record<ProBenefit, ...>` is the enforcement: add a benefit to the shared
 * list without writing its copy and this file stops compiling, and there is no
 * way to advertise something the list does not contain. The three definitions
 * of "what Pro is" — the shared list, the rules test and this screen — used to
 * be independent, so the first one to change made the other two lie.
 *
 * `shipped` exists because a plan can be sold before one of its features
 * lands, but a screen that describes it in the present tense while it does
 * nothing is selling something that does not exist. Making it a required
 * field means a feature cannot ship quietly half-true: someone has to come
 * back and flip it, which is what happened to `nearby` and has not yet
 * happened to `copilot`.
 */
interface BenefitCopy {
  title: MessageKey
  body: MessageKey
  icon: keyof typeof Feather.glyphMap
  /**
   * Interpolated into `body`. Numbers come from `PLAN_LIMITS` rather than
   * being typed out, because a paywall quoting a limit the server no longer
   * enforces is the worst kind of wrong.
   *
   * A bag rather than a bare `count` because a benefit can need several, and a
   * second optional field per placeholder is how the two drift apart.
   */
  vars?: Record<string, string | number>
  shipped: boolean
}

const BENEFIT_COPY: Record<ProBenefit, BenefitCopy> = {
  unlimitedInitiations: {
    title: 'paywall.unlimitedChats',
    body: 'paywall.unlimitedChatsBody',
    icon: 'message-circle',
    vars: { count: PLAN_LIMITS.free.initiationsPer24h ?? 0 },
    shipped: true,
  },
  advancedFilters: {
    title: 'paywall.advancedFilters',
    body: 'paywall.advancedFiltersBody',
    icon: 'sliders',
    shipped: true,
  },
  boostedProfile: {
    title: 'paywall.boostedProfile',
    body: 'paywall.boostedProfileBody',
    icon: 'zap',
    shipped: true,
  },
  profileViewerIdentities: {
    title: 'paywall.whoViewed',
    body: 'paywall.whoViewedBody',
    icon: 'eye',
    shipped: true,
  },
  incognito: {
    title: 'paywall.incognito',
    body: 'paywall.incognitoBody',
    icon: 'eye-off',
    shipped: true,
  },
  nearby: {
    // The body says what it does *and* what it costs the reader, because the
    // second half is the part they would otherwise find out after paying.
    title: 'paywall.nearby',
    body: 'paywall.nearbyBody',
    icon: 'map-pin',
    shipped: true,
  },
  sendTranslation: {
    title: 'paywall.sendTranslation',
    body: 'paywall.sendTranslationBody',
    icon: 'send',
    shipped: true,
  },
  deckExport: {
    title: 'paywall.deckExport',
    body: 'paywall.deckExportBody',
    icon: 'download',
    shipped: true,
  },
  /*
   * Both of these are the paid number, not the free one — unlike the chat
   * allowance above, which sells by naming the limit you are hitting.
   * Translation is not unlimited anywhere, so the honest pitch is how much
   * more you get.
   */
  translationQuota: {
    title: 'paywall.translationQuota',
    body: 'paywall.translationQuotaBody',
    icon: 'globe',
    vars: { count: PLAN_LIMITS.pro.translationsPer24h },
    shipped: true,
  },
  learningLanguages: {
    title: 'paywall.learningLanguages',
    body: 'paywall.learningLanguagesBody',
    icon: 'book-open',
    vars: { count: PLAN_LIMITS.pro.maxLearningLanguages },
    shipped: true,
  },
  copilot: {
    title: 'paywall.copilot',
    body: 'paywall.copilotBody',
    icon: 'cpu',
    shipped: false,
  },
  welcomePack: {
    title: 'paywall.welcomePack',
    body: 'paywall.welcomePackBody',
    icon: 'gift',
    shipped: true,
  },
}

/**
 * The four benefits the page leads with; the rest sit behind "And N more".
 *
 * Chosen for what somebody on the free plan actually runs into — the chat
 * allowance, the viewer list, the filters — and for bodies short enough to
 * read at a glance. Twelve rows of equal weight was the old page, and a list
 * nobody finishes sells nothing. When the screen was opened from a locked
 * feature, that feature takes the first place instead (`highlightsFor`).
 */
const HIGHLIGHTS: readonly ProBenefit[] = [
  'unlimitedInitiations',
  'profileViewerIdentities',
  'advancedFilters',
  'sendTranslation',
]

function highlightsFor(refused: PlanFeature | null): readonly ProBenefit[] {
  if (refused === null) return HIGHLIGHTS
  return [refused, ...HIGHLIGHTS.filter((benefit) => benefit !== refused)].slice(
    0,
    HIGHLIGHTS.length,
  )
}

/**
 * Names for the contextual line, derived from the copy above rather than
 * retyped — the paywall must not call a capability one thing in its list and
 * another in the sentence explaining why the screen opened.
 *
 * `Record<PlanFeature, string>` is the enforcement: a capability added to the
 * feature list without a name here stops this file compiling.
 */
const FEATURE_TITLE: Record<PlanFeature, MessageKey> = {
  advancedFilters: BENEFIT_COPY.advancedFilters.title,
  boostedProfile: BENEFIT_COPY.boostedProfile.title,
  sendTranslation: BENEFIT_COPY.sendTranslation.title,
  deckExport: BENEFIT_COPY.deckExport.title,
  profileViewerIdentities: BENEFIT_COPY.profileViewerIdentities.title,
  incognito: BENEFIT_COPY.incognito.title,
  nearby: BENEFIT_COPY.nearby.title,
  copilot: BENEFIT_COPY.copilot.title,
}

/** A route param is a string from anywhere — a deep link, a stale URL — so it is checked against the real list before being trusted as one. */
function parseFeature(raw: string | undefined): PlanFeature | null {
  if (!raw) return null
  return (PLAN_FEATURES as readonly string[]).includes(raw) ? (raw as PlanFeature) : null
}

/** As above: a param from a deep link is a string until it is checked. */
function parseSource(raw: string | undefined): PaywallSource {
  return (PAYWALL_SOURCES as readonly string[]).includes(raw ?? '')
    ? (raw as PaywallSource)
    : 'gate'
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Below this window height — an iPhone SE, a phone in split view — the lead
 * paragraph gives its lines to the plan cards, so the yearly card is on screen
 * without a scroll. The headline and the four benefits already make the case.
 */
const COMPACT_HEIGHT = 700

export default function PaywallScreen() {
  useScreenInteractive()
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()
  const { height: windowHeight } = useWindowDimensions()

  // Reached from the profile, the viewer list, filters, Discover and a chat
  // thread, so the caller says where back leads.
  const {
    feature: featureParam,
    from,
    source: sourceParam,
  } = useLocalSearchParams<{
    feature?: string
    from?: string
    source?: string
  }>()
  const feature = parseFeature(featureParam)
  const source = parseSource(sourceParam)
  const quota = useQuota()
  const refresh = useRefreshEntitlement()
  const tier = useEffectiveTier()
  const me = useMe()
  // The store and the end date beside the tier: a gift that runs out can be
  // subscribed on top of, a subscription or a lifetime cannot, and
  // `planChangeFor` is the one place that is decided.
  const held: HeldPlan = {
    tier,
    store: tier === 'free' ? null : me.data?.entitlement?.store,
    expiresAt: me.data?.entitlement?.expiresAt ?? null,
  }
  const change = planChangeFor(held)
  // The context line only for somebody who can still buy what they were
  // refused — a subscriber sent here from the Boosted strip already has it.
  const refused = feature !== null && change === 'buy' ? feature : null
  const remaining = quota.data?.initiations.remaining

  // `null` while the store is still being asked. Distinguishing that from "the
  // store said nothing" matters: one is a spinner, the other is the honest
  // "you cannot buy this right now" state below.
  const [offers, setOffers] = useState<PurchaseOffer[] | null>(null)
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  // One period at a time. Picked rather than seeded, so the screen opens on
  // whatever the store actually sells first.
  const [pickedPeriod, setPickedPeriod] = useState<BillingPeriod | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [storeWaitOver, setStoreWaitOver] = useState(false)

  useEffect(() => {
    let cancelled = false
    void getOffers().then((result) => {
      if (!cancelled) setOffers(result)
    })
    const timer = setTimeout(() => setStoreWaitOver(true), STORE_WAIT_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  // Once per opening, with what sent them here. The paywall is the end of the
  // funnel, and which capability people hit it from is the question. Mount
  // only: the tier changing after a purchase is not a second viewing.
  useEffect(() => {
    track({ name: 'paywall_viewed', properties: { feature: feature ?? null, tier, source, gift } })
  }, [])

  /**
   * Closing without buying, and how long the screen was open for.
   *
   * The pair `paywall_viewed`/`paywall_dismissed` is what separates "nobody
   * reads this" from "everybody reads it and says no" — two failures with
   * opposite fixes. Both exits go through here: the X, and the onboarding
   * paywall's own "Continue free".
   *
   * A hardware back on Android is not caught, and deliberately not fought
   * over: it leaves the same view unbought and shows up as a view with no
   * dismissal, which is a known and countable gap rather than a wrong number.
   */
  const openedAt = useRef(Date.now())

  function dismiss(): void {
    track({
      name: 'paywall_dismissed',
      properties: { source, seconds_open: Math.round((Date.now() - openedAt.current) / 1000) },
    })
    // The onboarding exposure is the last screen of the wizard, so there is
    // nothing behind it worth going back to — and `goBackTo` would pop onto
    // `done`, whose CTA opened this.
    if (source === 'onboarding') {
      router.replace('/(app)/(tabs)/discover')
      return
    }
    goBackTo('/(app)/(tabs)/me', from)
  }

  async function buy(offerId: string, change: PlanChange): Promise<void> {
    setNotice(null)
    setBusyOfferId(offerId)
    // The client's view of the store sheet, for the funnel. Revenue truth
    // comes from RevenueCat's own integration, not from here.
    const chosen = offers?.find((offer) => offer.id === offerId)
    const sale = {
      offer: offerId,
      tier: chosen?.tier ?? null,
      period: chosen?.period ?? null,
      change,
      // `null` for an ineligible account too: `getOffers` already leaves the
      // trial off a package this person cannot have one on.
      trial_days: chosen?.freeTrialDays ?? null,
    }
    track({ name: 'purchase_started', properties: sale })
    const outcome = await purchaseOffer(offerId)
    track({ name: 'purchase_finished', properties: { ...sale, outcome } })
    setBusyOfferId(null)

    // A store purchase is only half of it: entitlement lives in
    // `profiles.entitlement`, written by RevenueCat's webhook. That webhook can
    // be seconds late or lost entirely, so the client asks the server to
    // reconcile rather than waiting and hoping.
    if (outcome === 'purchased') {
      refresh.mutate()
      return
    }
    // A deliberate cancellation is not an error and gets no message — telling
    // someone their own choice failed is how a paywall teaches them it is broken.
    if (outcome === 'failed') setNotice(t('paywall.purchaseFailed'))
    if (outcome === 'unavailable') setNotice(t('paywall.purchaseUnavailable'))
  }

  async function restore(): Promise<void> {
    setNotice(null)
    setRestoring(true)
    const ok = await restorePurchases()
    setRestoring(false)
    // Reconcile either way: the server is the authority on entitlement, and it
    // can find a subscription the local store call could not.
    refresh.mutate()
    if (!ok) setNotice(t('paywall.nothingToRestore'))
  }

  function pick(next: BillingPeriod): void {
    if (next === period) return
    void selection()
    setPickedPeriod(next)
  }

  const tierOffers = offers?.filter((offer) => offer.tier === 'pro') ?? []
  const periods = PERIOD_ORDER.filter((candidate) =>
    tierOffers.some((offer) => offer.period === candidate),
  )
  // Falls back to the first period sold when the picked one is not — a store
  // without a monthly must not leave the page without a price.
  const period = pickedPeriod !== null && periods.includes(pickedPeriod) ? pickedPeriod : periods[0]
  const offer = tierOffers.find((candidate) => candidate.period === period)
  // What the yearly saving is measured against. Taken from the offers the store
  // just returned rather than from a constant — `planSaving.ts` says why.
  const yearly = tierOffers.find((candidate) => candidate.period === 'yearly')
  const monthly = tierOffers.find((candidate) => candidate.period === 'monthly')
  // Months first — "3 months free" — and the percentage only when a year gives
  // away less than one whole month.
  const freeMonths = yearly ? yearlyFreeMonths(yearly, monthly) : null
  const saving = yearly && freeMonths === null ? yearlySavingPercent(yearly, monthly) : null

  const boughtOn = platformOfStore(held.store)
  const gift = tier !== 'free' && held.store === 'gift' && Boolean(held.expiresAt)
  const isCurrent = change === 'covered'
  /*
   * The trial the tap would start: its length from the store, `null` over a
   * plan already held and when the store did not offer one — `ineligibleForTrial`
   * leaves it out for somebody who has had it, and then the page is a plain
   * "Subscribe" with no trial wording anywhere.
   */
  const trialDays = offer?.freeTrialDays && !isCurrent ? offer.freeTrialDays : null
  // Said in weeks when it is whole weeks — "1 week free", as the stores sell
  // it — and in days otherwise.
  const trialWeeks = trialDays !== null && trialDays % 7 === 0 ? trialDays / 7 : null
  const periodPhrase = offer ? t(PERIOD_PHRASE[offer.period]) : ''

  // The entrance waits for the store (see `STORE_WAIT_MS`), except over a plan
  // already held, whose page does not depend on it.
  const ready = offers !== null || storeWaitOver || isCurrent

  const headline = isCurrent
    ? t('paywall.ownedHeadline', { plan: TIER_NAMES.pro })
    : trialWeeks !== null
      ? t('paywall.trialHeadlineWeeks', { count: trialWeeks, plan: TIER_NAMES.pro })
      : trialDays !== null
        ? t('paywall.trialHeadlineDays', { count: trialDays, plan: TIER_NAMES.pro })
        : t('paywall.headline', { plan: TIER_NAMES.pro })

  /*
   * The trial laid out as dates rather than "day 7": the reader's own calendar
   * is what they will check it against. The charge date is the trial's length
   * from now, which is how both stores count it.
   */
  const chargeDate =
    trialDays !== null
      ? new Date(Date.now() + trialDays * DAY_MS).toLocaleDateString(locale, {
          day: 'numeric',
          month: 'long',
        })
      : null
  const trialSteps: TrialStep[] | null =
    offer && chargeDate !== null
      ? [
          {
            icon: 'unlock',
            title: t('paywall.timelineToday'),
            body: t('paywall.timelineTodayBody', { plan: TIER_NAMES.pro }),
          },
          {
            icon: 'x-circle',
            title: t('paywall.timelineCancel'),
            body: t('paywall.timelineCancelBody', { date: chargeDate }),
          },
          {
            icon: 'calendar',
            title: t('paywall.timelineStarts', { date: chargeDate }),
            body: t('paywall.timelineStartsBody', {
              price: offer.priceString,
              period: periodPhrase,
            }),
          },
        ]
      : null

  /*
   * The whole sequence — how long the trial runs and what it renews at —
   * directly above the button that starts it, not only in the small print.
   * App Review guideline 3.1.2 asks for the trial's own terms next to the
   * trial, and for the renewal price next to any subscription.
   */
  const terms =
    offer && !isCurrent
      ? trialDays !== null
        ? `${
            trialWeeks !== null
              ? t('paywall.trialWeeks', {
                  count: trialWeeks,
                  price: offer.priceString,
                  period: periodPhrase,
                })
              : t('paywall.trialTerms', {
                  count: trialDays,
                  price: offer.priceString,
                  period: periodPhrase,
                })
          } · ${t('paywall.cancelAnytime')}`
        : t('paywall.renewsSummary', { price: offer.priceString, period: periodPhrase })
      : null

  const hasTopLines = refused !== null || remaining === 0 || tier !== 'free'
  const highlights = highlightsFor(refused)
  const rest = PRO_BENEFITS.filter((benefit) => !highlights.includes(benefit))

  return (
    <Screen fluid style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.backPlain')}
          hitSlop={12}
          onPress={dismiss}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <Feather name="x" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.spacer} />
        {/*
          Required by Apple on any screen that sells a subscription, and it has
          to work for someone reinstalling on a new device — so it runs a real
          SDK restore, not only the server-side reconcile.
        */}
        <Pressable
          accessibilityRole="button"
          onPress={() => void restore()}
          disabled={restoring}
          hitSlop={8}
          style={styles.restore}
        >
          <Text style={styles.restoreText}>
            {restoring || refresh.isPending ? t('common.checking') : t('paywall.restorePurchases')}
          </Text>
        </Pressable>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.content}>
        <View style={styles.column}>
          <Reveal index={0} ready={ready} style={styles.hero}>
            {TIER_BADGES.pro ? (
              <View style={styles.proMark}>
                <Feather name="star" size={12} color={colors.bg} />
                <Text style={styles.proMarkText}>{TIER_BADGES.pro}</Text>
              </View>
            ) : null}
            <Text style={styles.headline} accessibilityRole="header">
              {headline}
            </Text>
            {/*
              The lead is the free plan's promise, so it is not said to
              somebody who already pays, and it gives way on a short screen.
            */}
            {isCurrent || windowHeight < COMPACT_HEIGHT ? null : (
              <Text style={styles.lead}>{t('paywall.headlineBody')}</Text>
            )}
          </Reveal>

          {/*
            Says why this screen opened, when the caller knew, and what the
            reader already holds. Someone who just tapped a locked filter is
            answering a different question from someone who opened the paywall
            from their profile, and a generic pitch answers neither of them
            well. Every status line about the held plan belongs in this box.
          */}
          {hasTopLines ? (
            <Reveal index={1} ready={ready} style={styles.context}>
              {refused ? (
                <Text style={styles.contextText}>
                  <Text style={styles.contextFeature}>{t(FEATURE_TITLE[refused])}</Text>{' '}
                  {t('paywall.partOf')} {TIER_NAMES.pro}.
                </Text>
              ) : null}
              {remaining === 0 ? (
                <Text style={styles.contextText}>
                  {t('paywall.quotaNotice', { count: PLAN_LIMITS.free.initiationsPer24h ?? 0 })}
                </Text>
              ) : null}
              {/*
                Three states, not two. A lifetime grant says so; a plan a store
                sold says where to manage it; and a plan that came from neither
                — granted by hand, `store: 'manual'` — says nothing at all,
                because "manage it in your store account" points at a page with
                nothing on it. That was already fixed for the lifetime gift and
                `boughtOn` is what makes it true of every grant: `platformOfStore`
                answers `null` for anything no store of ours sold.
              */}
              {/*
                A gift of months: it ends on a date and nothing renews it, so
                the offer below is a real one — subscribing is how Pro carries
                on after the gift.
              */}
              {gift ? (
                <Text style={styles.contextText}>
                  {t('paywall.giftNotice', {
                    plan: TIER_NAMES[tier],
                    date: new Date(held.expiresAt as string).toLocaleDateString(locale),
                  })}
                </Text>
              ) : null}
              {tier !== 'free' && (held.store === 'promotional' || boughtOn) ? (
                <Text style={styles.contextText}>
                  {held.store === 'promotional'
                    ? t('paywall.lifetimeNotice', { plan: TIER_NAMES[tier] })
                    : t('paywall.manageNotice', { plan: TIER_NAMES[tier] })}
                </Text>
              ) : null}
            </Reveal>
          ) : null}

          <Reveal index={2} ready={ready} style={styles.benefits}>
            {highlights.map((benefit) => (
              <BenefitRow key={benefit} copy={BENEFIT_COPY[benefit]} />
            ))}
            {showAll ? (
              <Reveal index={0} ready style={styles.benefits}>
                {rest.map((benefit) => (
                  <BenefitRow key={benefit} copy={BENEFIT_COPY[benefit]} />
                ))}
              </Reveal>
            ) : null}
            {rest.length > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showAll }}
                onPress={() => setShowAll((open) => !open)}
                hitSlop={8}
                style={({ pressed }) => [styles.more, pressed && styles.pressed]}
              >
                <Text style={styles.moreText}>
                  {showAll ? t('paywall.showLess') : t('paywall.andMore', { count: rest.length })}
                </Text>
                <Feather
                  name={showAll ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color={colors.accent}
                />
              </Pressable>
            ) : null}
          </Reveal>

          {/* Over a plan already held there is nothing here to pick. */}
          {isCurrent ? null : (
            <Reveal index={3} ready={ready} style={styles.plans}>
              {offers === null ? (
                // The cards' own height, so nothing jumps when the store answers.
                <>
                  <Skeleton height={76} radius={16} />
                  <Skeleton height={76} radius={16} />
                </>
              ) : periods.length > 0 ? (
                <View
                  accessibilityRole="radiogroup"
                  accessibilityLabel={t('paywall.billingPeriod')}
                  style={styles.options}
                >
                  {periods.map((candidate) => {
                    const option = tierOffers.find((item) => item.period === candidate)
                    if (!option) return null
                    return (
                      <PlanOption
                        key={candidate}
                        selected={candidate === period}
                        onSelect={() => pick(candidate)}
                        {...optionCopy(option, t, { freeMonths, saving })}
                      />
                    )
                  })}
                </View>
              ) : (
                <Text style={styles.unavailable}>
                  {t(isPurchasesAvailable() ? 'paywall.noPlans' : 'paywall.notSetUp')}
                </Text>
              )}
            </Reveal>
          )}

          {trialSteps ? (
            <Reveal index={4} ready={ready}>
              <TrialTimeline title={t('paywall.timelineTitle')} steps={trialSteps} />
            </Reveal>
          ) : null}

          <View style={styles.footnote}>
            {/*
              A web purchase is held by RevenueCat's own store, not by Apple or
              Google, and is cancelled from the portal behind Settings.
            */}
            <Text style={styles.legal}>
              {t(Platform.OS === 'web' ? 'paywall.legalWeb' : 'paywall.legal')}
            </Text>
            <View style={styles.legalLinks}>
              <Pressable onPress={() => void Linking.openURL(TERMS_URL)} hitSlop={8}>
                <Text style={styles.legalLink}>{t('paywall.terms')}</Text>
              </Pressable>
              <Text style={styles.legalDot}>·</Text>
              <Pressable onPress={() => void Linking.openURL(PRIVACY_URL)} hitSlop={8}>
                <Text style={styles.legalLink}>{t('paywall.privacy')}</Text>
              </Pressable>
              {/* App Store subscriptions are sold under Apple's own EULA. */}
              {Platform.OS === 'ios' ? (
                <>
                  <Text style={styles.legalDot}>·</Text>
                  <Pressable onPress={() => void Linking.openURL(APPLE_EULA_URL)} hitSlop={8}>
                    <Text style={styles.legalLink}>{t('paywall.eula')}</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.footerColumn}>
          {/* In the footer, beside the button, because that is where the eye is after a tap. */}
          {notice ? (
            <Text style={styles.notice} accessibilityLiveRegion="polite">
              {notice}
            </Text>
          ) : null}
          {terms ? <Text style={styles.terms}>{terms}</Text> : null}
          <Button
            label={
              // The plan held, said plainly, rather than a greyed-out "Start".
              // A free week says so on the button, which is what the tap starts.
              isCurrent
                ? t('paywall.currentPlan')
                : trialWeeks !== null
                  ? t('paywall.startTrial', { count: trialWeeks })
                  : trialDays !== null
                    ? t('paywall.startFreeTrial')
                    : t('paywall.subscribe')
            }
            loading={(offers === null && !isCurrent) || busyOfferId !== null}
            disabled={isCurrent || offer === undefined}
            onPress={() => (offer ? buy(offer.id, change) : undefined)}
          />
          {/*
            Only the onboarding exposure, and named rather than deflected: "No
            thanks" and "Maybe later" both imply the free app is a consolation.
            It is the product, and somebody arriving here in their first minute
            has to be able to see that in one tap.
          */}
          {source === 'onboarding' ? (
            <Button variant="secondary" label={t('paywall.continueFree')} onPress={dismiss} />
          ) : null}
          {/*
            The "Have a gift code?" link: under the button and above nothing, so
            it never competes with the purchase itself. Not for a lifetime
            holder, whom the server would refuse — there is nothing to add.
          */}
          {tier !== 'free' && held.store === 'promotional' ? null : <GiftCodeEntry />}
        </View>
      </View>
    </Screen>
  )
}

/**
 * What one plan card says. Every card quotes a month on the right, so the two
 * compare at a glance, and the charge itself underneath in the store's words.
 *
 * A yearly plan's month is truncated so the `.99` the price was chosen for
 * survives — see `perMonthPriceString` — with the store's rounded text only as
 * a fallback, and the full yearly charge as the card's own detail line.
 */
function optionCopy(
  offer: PurchaseOffer,
  t: ReturnType<typeof useT>,
  saving: { freeMonths: number | null; saving: number | null },
): Omit<Parameters<typeof PlanOption>[0], 'selected' | 'onSelect'> {
  const title = t(PERIOD_LABEL[offer.period])
  if (offer.period === 'yearly') {
    const perMonth =
      perMonthPriceString(offer.priceString, offer.price) ?? offer.perMonthPriceString ?? null
    const price = perMonth ?? offer.priceString
    const unit = t(perMonth ? 'paywall.perMonth' : 'paywall.perYear')
    const detail = t('paywall.billedYearly', { price: offer.priceString })
    const badge =
      saving.freeMonths !== null
        ? t('paywall.freeMonths', { count: saving.freeMonths })
        : saving.saving !== null
          ? t('paywall.savePercent', { percent: saving.saving })
          : null
    return {
      title,
      price,
      unit,
      detail,
      badge,
      accessibilityLabel: [title, `${price} ${unit}`, detail, badge]
        .filter((part): part is string => Boolean(part))
        .join('. '),
    }
  }
  const unit = t(PERIOD_PHRASE[offer.period])
  const detail = t(offer.period === 'monthly' ? 'paywall.billedMonthly' : 'paywall.lifetimeDetail')
  return {
    title,
    price: offer.priceString,
    unit,
    detail,
    badge: null,
    accessibilityLabel: [title, `${offer.priceString} ${unit}`, detail].join('. '),
  }
}

/**
 * One benefit: its glyph on a quiet tile, the name, and the number it comes
 * with underneath — the limit is the part of the promise worth keeping
 * visible. A not-yet-shipped feature keeps its name and body but wears the tag.
 */
function BenefitRow({ copy }: { copy: BenefitCopy }) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()

  return (
    <View style={styles.benefit}>
      <View style={styles.benefitIcon}>
        <Feather name={copy.icon} size={18} color={colors.pro} />
      </View>
      <View style={styles.benefitText}>
        <Text style={styles.benefitTitle}>{t(copy.title)}</Text>
        <Text style={styles.benefitBody}>{t(copy.body, copy.vars)}</Text>
      </View>
      {copy.shipped ? null : <Text style={styles.soonTag}>{t('common.comingSoon')}</Text>}
    </View>
  )
}

/**
 * The reading column. Narrower than the app's own 720 on a wide window: a
 * price card stretched across a desktop is a form, not an offer.
 */
const COLUMN = 480

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  // The header and footer hairlines run edge to edge, so the screen's gutter
  // moves onto the blocks themselves — the same shape as the chat screen.
  screen: { paddingHorizontal: 0 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    paddingBottom: spacing.sm,
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  // 34 square: the glyph's own hit box, before `hitSlop` widens it.
  close: { alignItems: 'center', height: 34, justifyContent: 'center', width: 34 },
  spacer: { flex: 1 },
  restore: { height: 40, justifyContent: 'center' },
  restoreText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.5 },
  body: { flex: 1 },
  content: { alignItems: 'center', paddingHorizontal: 20 },
  column: { gap: 20, maxWidth: COLUMN, paddingBottom: spacing.lg, width: '100%' },

  hero: { alignItems: 'flex-start', gap: spacing.md },
  proMark: {
    alignItems: 'center',
    backgroundColor: colors.pro,
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  // The ground's colour on the plan's: white on violet in light, near-black on
  // the lifted violet of dark, where white would sit under 3:1.
  proMarkText: {
    color: colors.bg,
    fontFamily: DISPLAY_FONT,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  headline: { ...font.title, color: colors.text, letterSpacing: -0.3, lineHeight: 36 },
  lead: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },

  context: {
    backgroundColor: colors.infoBg,
    borderRadius: radius.md,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  contextText: { color: colors.text, fontSize: 14, lineHeight: 21 },
  contextFeature: { color: colors.accent, fontWeight: '700' },

  benefits: { gap: spacing.md },
  benefit: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  benefitIcon: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.md,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  benefitText: { flex: 1, gap: 2 },
  benefitTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  benefitBody: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  soonTag: {
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  more: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 32,
  },
  moreText: { color: colors.accent, fontSize: 15, fontWeight: '600' },

  // Room above the first card for the badge that straddles its edge.
  plans: { gap: spacing.md, paddingTop: spacing.sm },
  options: { gap: spacing.lg },
  unavailable: { color: colors.textMuted, fontSize: 14, lineHeight: 22 },

  footnote: { gap: spacing.sm },
  legal: { color: colors.textFaint, fontSize: 13, lineHeight: 20 },
  legalLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  legalLink: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  legalDot: { color: colors.textFaint, fontSize: 13 },

  footer: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: spacing.md,
  },
  footerColumn: { gap: spacing.md, maxWidth: COLUMN, width: '100%' },
  notice: { color: colors.danger, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  terms: { color: colors.textMuted, fontSize: 13, lineHeight: 18, textAlign: 'center' },
}))
