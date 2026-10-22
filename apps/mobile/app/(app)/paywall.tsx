import Feather from '@expo/vector-icons/Feather'
import { Nunito_900Black } from '@expo-google-fonts/nunito/900Black'
import {
  PLAN_FEATURES,
  PLAN_LIMITS,
  planChangeFor,
  platformOfStore,
  type BillingPeriod,
  type HeldPlan,
  type PlanChange,
  type PlanFeature,
  TIER_NAMES,
} from '@langx/shared'
import { useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { useFonts } from 'expo-font'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import {
  keys,
  useEffectiveTier,
  useMe,
  useQuota,
  useRefreshEntitlement,
  type ViewerPageDto,
} from '../../src/api/queries'
import { GiftCodeEntry } from '../../src/components/GiftCodeEntry'
import { CompareTable } from '../../src/components/paywall/CompareTable'
import { PlanCard } from '../../src/components/paywall/PlanCard'
import { Reveal } from '../../src/components/paywall/Reveal'
import { TrialTimeline, type TrialStep } from '../../src/components/paywall/TrialTimeline'
import { Button } from '../../src/components/ui/Button'
import { ICON_BUTTON_TARGET, IconButton } from '../../src/components/ui/IconButton'
import { Screen } from '../../src/components/ui/Screen'
import { Skeleton } from '../../src/components/ui/Skeleton'
import { track } from '../../src/lib/analytics'
import { PAYWALL_SOURCES, type PaywallSource } from '../../src/lib/analyticsEvents'
import { emphasise, emphasisRuns } from '../../src/lib/emphasis'
import { selection } from '../../src/lib/haptics'
import { goBackTo } from '../../src/lib/navigation'
import {
  BENEFIT_COPY,
  COMPARE_LEAD,
  FEATURE_TITLE,
  compareRows,
  highlightsFor,
  pendingTag,
  sellableFeature,
  type BenefitCopy,
} from '../../src/lib/paywallBenefits'
import { paywallOffersState, restoreResult } from '../../src/lib/paywallAnalytics'
import {
  opensOn,
  parsePaywallLimit,
  parseRetryAt,
  paywallRoad,
  showsViewerCount,
  type PaywallRoad,
} from '../../src/lib/paywallRoad'
import { planPrice } from '../../src/lib/planPrice'
import {
  getOffers,
  isPurchasesAvailable,
  purchaseOffer,
  restorePurchases,
  type PurchaseOffer,
} from '../../src/lib/purchases'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { APPLE_EULA_URL, PRIVACY_URL, TERMS_URL } from '../../src/lib/externalLinks'
import { useDisplayNames, useLocale, useT, type MessageKey } from '../../src/i18n'
import { usePaywallTracking } from '../../src/hooks/usePaywallTracking'
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
 * The hero depends on the store's answer — the free week under the headline is
 * only true when a trial came back — so the page holds its entrance until the
 * offers arrive rather than opening without that line and pushing everything
 * down when it lands. RevenueCat usually answers from its cache in a fraction
 * of this; a store that has not answered by then gets no trial line and the
 * skeletons. The headline's own font waits under the same second, for the
 * same reason.
 */
const STORE_WAIT_MS = 1000

/** The headline each road opens on, over a plan that is still for sale. */
const ROAD_HEADLINE: Record<Exclude<PaywallRoad, 'owned' | 'chatLimit'>, MessageKey> = {
  viewers: 'paywall.heroViewers',
  filters: 'paywall.heroFilters',
  nearby: 'paywall.heroNearby',
  feature: 'paywall.headline',
  general: 'paywall.headline',
}

/**
 * The capabilities Pro adds to the filters screen, as the chips the paywall
 * shows locked when it was opened from one. Named by the filters screen's own
 * keys, so the chip reads exactly as the control that sent somebody here.
 */
const LOCKED_FILTERS: readonly MessageKey[] = [
  'filters.gender',
  'filters.onlyMyGender',
  'filters.city',
]

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

/** What a plan card measures, for the loading skeleton: its minimum, which a card on a phone keeps. */
const CARD_HEIGHT = 96

export default function PaywallScreen() {
  useScreenInteractive()
  const { v3 } = useTheme()
  const styles = useStyles()
  const t = useT()
  const { locale } = useLocale()
  const names = useDisplayNames()
  const queryClient = useQueryClient()
  // The title is Nunito Black, which the root layout does not load: it would
  // hold every cold start's splash for a screen most launches never open.
  // The page waits for it under the same second it waits for the store, so
  // the headline never arrives in the platform face and swaps.
  const [fontLoaded, fontError] = useFonts({ Nunito_900Black })

  // Reached from the profile, the viewer list, filters, Discover and a chat
  // thread, so the caller says where back leads.
  const {
    feature: featureParam,
    from,
    source: sourceParam,
    limit: limitParam,
    retryAt: retryAtParam,
  } = useLocalSearchParams<{
    feature?: string
    from?: string
    source?: string
    limit?: string
    retryAt?: string
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
  // refused — a subscriber sent here from the Boosted strip already has it —
  // and only for a capability that is on for every buyer (`sellableFeature`).
  // Analytics keep the raw `feature`.
  const refused = change === 'buy' ? sellableFeature(feature) : null
  const remaining = quota.data?.initiations.remaining
  const freeChats = PLAN_LIMITS.free.initiationsPer24h ?? 0

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

  /**
   * The X and "Continue free". The dismissal event is not sent from here:
   * every way out of the screen — these, Android's back button, the iOS swipe
   * — is counted once by `usePaywallTracking`, which is only told that this
   * one was ours.
   */
  function dismiss(): void {
    tracking.markClosed()
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
      tracking.markPurchased()
      refresh.mutate()
      return
    }
    // A deliberate cancellation is not an error and gets no message — telling
    // someone their own choice failed is how a paywall teaches them it is broken.
    if (outcome === 'failed') setNotice(t('paywall.purchaseFailed'))
    if (outcome === 'unavailable') setNotice(t('paywall.purchaseUnavailable'))
  }

  async function restore(): Promise<void> {
    track({ name: 'restore_tapped', properties: { source } })
    setNotice(null)
    setRestoring(true)
    const ok = await restorePurchases()
    track({ name: 'restore_finished', properties: { source, result: restoreResult(ok) } })
    setRestoring(false)
    // Reconcile either way: the server is the authority on entitlement, and it
    // can find a subscription the local store call could not.
    refresh.mutate()
    if (!ok) setNotice(t('paywall.nothingToRestore'))
  }

  function pick(next: BillingPeriod): void {
    if (next === period) return
    // The one haptic on the page: the choice landed. The card's tick springs
    // with it.
    void selection()
    track({ name: 'plan_selected', properties: { source, period: next } })
    setPickedPeriod(next)
  }

  function toggleBenefits(): void {
    if (!showAll) track({ name: 'benefits_expanded', properties: { source } })
    setShowAll((open) => !open)
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
  const monthly = tierOffers.find((candidate) => candidate.period === 'monthly')

  const boughtOn = platformOfStore(held.store)
  const gift = tier !== 'free' && held.store === 'gift' && Boolean(held.expiresAt)
  const isCurrent = change === 'covered'
  // The allowance is only somebody's to have spent on the free plan; a gift
  // already lifts it.
  const road = paywallRoad({
    owned: isCurrent,
    refused,
    limit: tier === 'free' ? parsePaywallLimit(limitParam) : null,
  })
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
  // already held, whose page does not depend on it — and for the headline's
  // font, but never past the same second.
  const ready =
    (offers !== null || storeWaitOver || isCurrent) &&
    (fontLoaded || fontError !== null || storeWaitOver)

  // Opened and left, once each. The view is counted when the page is first
  // shown so that it can say what the store had to sell; see the hook.
  const tracking = usePaywallTracking({
    feature,
    tier,
    source,
    gift,
    ready,
    offers: paywallOffersState({ owned: isCurrent, offers }),
  })

  /*
   * What only Pro adds, said for the road that brought somebody here. Spent
   * chats ask to meet more people in the language they are learning — named,
   * because "as many English speakers as you like" is a picture and
   * "unlimited initiations" is a spreadsheet.
   */
  const learning = [...(me.data?.learning ?? [])].sort((a, b) => a.priority - b.priority)[0]
  const headline =
    road === 'owned'
      ? t('paywall.ownedHeadline', { plan: TIER_NAMES.pro })
      : road === 'chatLimit'
        ? learning
          ? t('paywall.heroChats', { language: names.language(learning.code) })
          : t('paywall.heroChatsAny')
        : t(ROAD_HEADLINE[road], { plan: TIER_NAMES.pro })
  /*
   * The free week, under the headline rather than as it. At title size the
   * headline is the largest type on the page, and a week for nothing is a
   * price claim: leading with it outranked the charge on every card, which
   * both stores want to be the most prominent price. The `trialHeadline*`
   * keys keep their names and their words, one size down.
   */
  const trialLine =
    trialWeeks !== null
      ? t('paywall.trialHeadlineWeeks', { count: trialWeeks, plan: TIER_NAMES.pro })
      : trialDays !== null
        ? t('paywall.trialHeadlineDays', { count: trialDays, plan: TIER_NAMES.pro })
        : null

  /*
   * When the next new chat opens: the API's own `retryAt` from the refusal
   * that sent somebody here, or the same figure off `/me/quota` when the
   * screen was opened some other way with the allowance spent. A plain time —
   * no countdown, because a ticking clock on a sales screen is pressure, and
   * the line is there to say the wait is short, not to make it feel long.
   */
  const now = new Date()
  const retryAt =
    parseRetryAt(retryAtParam, now) ??
    (remaining === 0 ? parseRetryAt(quota.data?.initiations.nextAvailableAt, now) : null)
  const retryDay = retryAt ? opensOn(retryAt, now) : null
  const retryTime = retryAt
    ? new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(retryAt)
    : null
  const chatLimitLine =
    retryDay !== null && retryTime !== null
      ? t(retryDay === 'today' ? 'paywall.chatLimitToday' : 'paywall.chatLimitTomorrow', {
          count: freeChats,
          time: retryTime,
        })
      : t('paywall.quotaNotice', { count: freeChats })

  // The viewer list's own weekly count, from the page it has just loaded — the
  // same number it shows the reader, never an identity, and never fetched
  // again for this.
  const weekPeople =
    road === 'viewers'
      ? queryClient.getQueryData<InfiniteData<ViewerPageDto>>(keys.viewers)?.pages[0]?.weekPeople
      : undefined

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
   *
   * The charge and its period are set strong inside the line, so on the one
   * line that names the free week, the billed amount still outranks it.
   */
  const billedPrice = offer ? emphasise(offer.priceString) : ''
  const billedPeriod = emphasise(periodPhrase)
  const terms =
    offer && !isCurrent
      ? // A one-off payment has nothing to cancel: it says what it costs and
        // that nothing renews, never "Cancel anytime".
        offer.period === 'lifetime'
        ? `${t('paywall.pricePerPeriod', { price: billedPrice, period: billedPeriod })} · ${t('paywall.lifetimeDetail')}`
        : trialDays !== null
          ? `${
              trialWeeks !== null
                ? t('paywall.trialWeeks', {
                    count: trialWeeks,
                    price: billedPrice,
                    period: billedPeriod,
                  })
                : t('paywall.trialTerms', {
                    count: trialDays,
                    price: billedPrice,
                    period: billedPeriod,
                  })
            } · ${t('paywall.cancelAnytime')}`
          : t('paywall.renewsSummary', { price: billedPrice, period: billedPeriod })
      : null

  // Over a gate, the reasons lead and the whole table follows the plans; with
  // no gate, the table is the reason.
  const gated = road !== 'owned' && road !== 'general'
  const rows = compareRows()
  const table = (
    <CompareTable
      rows={rows}
      lead={COMPARE_LEAD.length}
      expanded={showAll}
      onToggle={toggleBenefits}
    />
  )

  /*
   * Says why this screen opened, when the caller knew, and what the reader
   * already holds. Someone who just tapped a locked filter is answering a
   * different question from someone who opened the paywall from their
   * profile, and a generic pitch answers neither of them well. Every status
   * line about the held plan belongs in this block.
   */
  const contextLines: { icon: keyof typeof Feather.glyphMap; text: string; chips?: boolean }[] = []
  // Only while the allowance really is spent, by the server's own count: a
  // link that names the road, or a chat that freed up since the refusal,
  // must not be told it has started chats it has not. Before the count has
  // loaded, the refusal that opened the screen is the evidence.
  const spent =
    tier === 'free' && (remaining === 0 || (remaining === undefined && road === 'chatLimit'))
  if (spent) {
    contextLines.push({ icon: 'clock', text: chatLimitLine })
  }
  if (road === 'viewers' && showsViewerCount(weekPeople)) {
    contextLines.push({ icon: 'eye', text: t('paywall.viewersWeek', { count: weekPeople }) })
  } else if (refused !== null) {
    contextLines.push({
      icon: road === 'filters' ? 'sliders' : 'lock',
      text: t('paywall.featurePartOf', {
        feature: emphasise(t(FEATURE_TITLE[refused])),
        plan: TIER_NAMES.pro,
      }),
      chips: road === 'filters',
    })
  }
  /*
   * A gift of months: it ends on a date and nothing renews it, so the offer
   * below is a real one — subscribing is how Pro carries on after the gift.
   */
  if (gift) {
    contextLines.push({
      icon: 'gift',
      text: t('paywall.giftNotice', {
        plan: TIER_NAMES[tier],
        date: new Date(held.expiresAt as string).toLocaleDateString(locale),
      }),
    })
  }
  /*
   * Three states, not two. A lifetime grant says so; a plan a store sold says
   * where to manage it; and a plan that came from neither — granted by hand,
   * `store: 'manual'` — says nothing at all, because "manage it in your store
   * account" points at a page with nothing on it. `platformOfStore` answers
   * `null` for anything no store of ours sold.
   */
  if (tier !== 'free' && (held.store === 'promotional' || boughtOn)) {
    contextLines.push({
      icon: 'check-circle',
      text:
        held.store === 'promotional'
          ? t('paywall.lifetimeNotice', { plan: TIER_NAMES[tier] })
          : t('paywall.manageNotice', { plan: TIER_NAMES[tier] }),
    })
  }

  return (
    <Screen fluid style={styles.screen}>
      <View style={styles.header}>
        <IconButton
          icon="x"
          accessibilityLabel={t('common.backPlain')}
          onPress={dismiss}
          style={styles.close}
        />
        <View style={styles.spacer} />
        <View style={styles.planMark}>
          <Feather name="star" size={v3.icon.xs} color={v3.colors.pillText} />
          <Text style={styles.planMarkText}>{t('paywall.planMark', { plan: TIER_NAMES.pro })}</Text>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.content}>
        <View style={styles.column}>
          {contextLines.length > 0 ? (
            <Reveal index={0} ready={ready} style={styles.context}>
              {contextLines.map((line) => (
                <View key={line.icon} style={styles.contextLine}>
                  <Feather name={line.icon} size={v3.icon.md} color={v3.colors.fg} />
                  <View style={styles.contextBody}>
                    <Text style={styles.contextText}>
                      {emphasisRuns(line.text).map((run, index) =>
                        run.strong ? (
                          <Text key={index} style={styles.contextStrong}>
                            {run.text}
                          </Text>
                        ) : (
                          run.text
                        ),
                      )}
                    </Text>
                    {line.chips ? (
                      <View style={styles.chips}>
                        {LOCKED_FILTERS.map((key) => (
                          <View key={key} style={styles.chip}>
                            <Feather name="lock" size={v3.icon.xs} color={v3.colors.muted} />
                            <Text style={styles.chipText}>{t(key)}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
            </Reveal>
          ) : null}

          <Reveal index={1} ready={ready} style={styles.hero}>
            <Text style={styles.headline} accessibilityRole="header">
              {headline}
            </Text>
            {trialLine ? <Text style={styles.trialLine}>{trialLine}</Text> : null}
          </Reveal>

          <Reveal index={2} ready={ready} style={styles.benefits}>
            {gated
              ? highlightsFor(refused).map((benefit) => (
                  <BenefitRow key={benefit} copy={BENEFIT_COPY[benefit]} />
                ))
              : table}
          </Reveal>

          {/* Over a plan already held there is nothing here to pick. */}
          {isCurrent ? null : (
            <Reveal index={3} ready={ready}>
              {offers === null ? (
                // The cards' own heights and the gap between them, so nothing
                // jumps when the store answers.
                <View style={styles.options}>
                  <Skeleton height={CARD_HEIGHT} radius={v3.radius.tile} />
                  <Skeleton height={CARD_HEIGHT} radius={v3.radius.tile} />
                </View>
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
                      <PlanCard
                        key={candidate}
                        selected={candidate === period}
                        onSelect={() => pick(candidate)}
                        {...cardCopy(option, monthly, t)}
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

          {gated ? (
            <Reveal index={4} ready={ready}>
              {table}
            </Reveal>
          ) : null}

          {trialSteps ? (
            <Reveal index={5} ready={ready}>
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
            {/*
              The "Have a gift code?" link: at the foot of the page, where it
              never competes with the purchase. Not for a lifetime holder, whom
              the server would refuse — there is nothing to add.
            */}
            {tier !== 'free' && held.store === 'promotional' ? null : <GiftCodeEntry />}
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
          {/*
            The free plan's promise, pinned beside the button rather than
            scrolled with the page: it is on screen whatever the window's
            height, next to the plans it is about. Not said to somebody who
            already pays.
          */}
          {isCurrent ? null : (
            <View style={styles.promise}>
              <Feather name="check" size={v3.icon.md} color={v3.colors.correction} />
              <Text style={styles.promiseText}>{t('paywall.freePromise')}</Text>
            </View>
          )}
          {terms ? (
            <Text style={styles.terms}>
              {emphasisRuns(terms).map((run, index) =>
                run.strong ? (
                  <Text key={index} style={styles.termsBilled}>
                    {run.text}
                  </Text>
                ) : (
                  run.text
                ),
              )}
            </Text>
          ) : null}
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
            Named rather than deflected: "No thanks" and "Maybe later" both
            imply the free app is a consolation. It is the product. On the
            onboarding exposure, and where the chat allowance sent somebody —
            the same size as the purchase, because replying is still free and
            going back to it has to be as easy as paying.
          */}
          {source === 'onboarding' || road === 'chatLimit' ? (
            <Button variant="secondary" label={t('paywall.continueFree')} onPress={dismiss} />
          ) : null}
          <View style={styles.links}>
            {/*
              Required by Apple on any screen that sells a subscription, and it
              has to work for someone reinstalling on a new device — so it
              runs a real SDK restore, not only the server-side reconcile.
            */}
            <Pressable
              accessibilityRole="button"
              onPress={() => void restore()}
              disabled={restoring}
              style={styles.link}
            >
              <Text style={styles.linkText}>
                {restoring || refresh.isPending
                  ? t('common.checking')
                  : t('paywall.restorePurchases')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              onPress={() => void Linking.openURL(TERMS_URL)}
              style={styles.link}
            >
              <Text style={styles.linkText}>{t('paywall.terms')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              onPress={() => void Linking.openURL(PRIVACY_URL)}
              style={styles.link}
            >
              <Text style={styles.linkText}>{t('paywall.privacy')}</Text>
            </Pressable>
            {/* App Store subscriptions are sold under Apple's own EULA. */}
            {Platform.OS === 'ios' ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => void Linking.openURL(APPLE_EULA_URL)}
                style={styles.link}
              >
                <Text style={styles.linkText}>{t('paywall.eula')}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Screen>
  )
}

/**
 * What one plan card says. Every card leads with what the store will charge
 * and its period; a yearly card says what that comes to a month, and what it
 * saves, in the badge beneath it (`planPrice`).
 */
function cardCopy(
  offer: PurchaseOffer,
  monthly: PurchaseOffer | undefined,
  t: ReturnType<typeof useT>,
): Omit<Parameters<typeof PlanCard>[0], 'selected' | 'onSelect'> {
  const { billed, period, perMonth, saving } = planPrice(offer, monthly)
  const title = t(PERIOD_LABEL[period])
  const price = t('paywall.pricePerPeriod', { price: billed, period: t(PERIOD_PHRASE[period]) })
  const month =
    perMonth !== null
      ? t('paywall.pricePerPeriod', { price: perMonth, period: t('paywall.perMonth') })
      : null
  const save =
    saving === null
      ? null
      : 'months' in saving
        ? t('paywall.freeMonths', { count: saving.months })
        : t('paywall.savePercent', { percent: saving.percent })
  const badge =
    month !== null && save !== null
      ? t('paywall.yearlyBadge', { perMonth: month, saving: save })
      : (month ?? save)
  // A one-off payment says it never renews; a subscription's period already
  // says how it recurs.
  const detail = period === 'lifetime' ? t('paywall.lifetimeDetail') : null
  return {
    title,
    price,
    badge,
    detail,
    accessibilityLabel: [title, price, detail, badge]
      .filter((part): part is string => Boolean(part))
      .join('. '),
  }
}

/**
 * One reason, as v3 draws a row: the glyph on its hue's tile, the name, and
 * the number it comes with underneath — the limit is the part of the promise
 * worth keeping visible. A not-yet-shipped or beta feature keeps its name and
 * body but says so.
 */
function BenefitRow({ copy }: { copy: BenefitCopy }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const tag = pendingTag(copy)

  return (
    <View style={styles.benefit}>
      <View style={[styles.benefitIcon, { backgroundColor: v3.hues[copy.hue] }]}>
        <Feather name={copy.icon} size={v3.icon.lg} color={v3.colors.ink} />
      </View>
      <View style={styles.benefitText}>
        <Text style={styles.benefitTitle}>{t(copy.title)}</Text>
        <Text style={styles.benefitBody}>{t(copy.body, copy.vars)}</Text>
      </View>
      {tag ? <Text style={styles.soonTag}>{t(tag)}</Text> : null}
    </View>
  )
}

/**
 * The reading column. Narrower than the app's own 720 on a wide window: a
 * price card stretched across a desktop is a form, not an offer.
 */
const COLUMN = 480
/** A benefit's tile: the drawing's 44, a glyph's width either side of it. */
const BENEFIT_TILE = 44

const useStyles = makeStyles(({ v3 }) => ({
  // The footer runs edge to edge, so the screen's gutter moves onto the
  // blocks themselves — the same shape as the chat screen.
  screen: { backgroundColor: v3.colors.bg, paddingHorizontal: 0 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[4],
  },
  // The glyph's own edge on the gutter, as the drawing has it, while its
  // target keeps the platform minimum.
  close: { marginStart: -v3.space[8] },
  spacer: { flex: 1 },
  planMark: {
    alignItems: 'center',
    backgroundColor: v3.colors.pill,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[6],
    minHeight: 32,
    paddingHorizontal: v3.space[12],
  },
  planMarkText: { ...v3.type.label, color: v3.colors.pillText },
  body: { flex: 1 },
  content: { alignItems: 'center', paddingHorizontal: v3.space[16] },
  column: {
    gap: v3.space[16],
    maxWidth: COLUMN,
    paddingBottom: v3.space[24],
    paddingTop: v3.space[8],
    width: '100%',
  },

  context: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.card,
    gap: v3.space[10],
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[12],
  },
  contextLine: { alignItems: 'flex-start', flexDirection: 'row', gap: v3.space[10] },
  contextBody: { flex: 1, gap: v3.space[10] },
  contextText: { ...v3.type.callout, color: v3.colors.fg },
  contextStrong: { fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[8] },
  chip: {
    alignItems: 'center',
    backgroundColor: v3.colors.bg,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[6],
    minHeight: 32,
    paddingHorizontal: v3.space[12],
  },
  chipText: { ...v3.type.label, color: v3.colors.fg },

  hero: { gap: v3.space[6] },
  headline: { ...v3.type.title, color: v3.colors.fg },
  // Below the charge on the cards in size, so the free week never outranks
  // what is billed.
  trialLine: { ...v3.type.callout, color: v3.colors.fg, fontWeight: '600' },

  benefits: { gap: v3.space[10] },
  benefit: { alignItems: 'center', flexDirection: 'row', gap: v3.space[14] },
  benefitIcon: {
    alignItems: 'center',
    borderRadius: v3.radius.icon,
    height: BENEFIT_TILE,
    justifyContent: 'center',
    width: BENEFIT_TILE,
  },
  benefitText: { flex: 1 },
  benefitTitle: { ...v3.type.button, color: v3.colors.fg },
  benefitBody: { ...v3.type.caption, color: v3.colors.muted },
  soonTag: { ...v3.type.label, color: v3.colors.muted },

  options: { gap: v3.space[8] },
  unavailable: { ...v3.type.callout, color: v3.colors.muted },

  footnote: { gap: v3.space[8] },
  legal: { ...v3.type.caption, color: v3.colors.muted },

  footer: {
    alignItems: 'center',
    backgroundColor: v3.colors.bg,
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[10],
  },
  footerColumn: { gap: v3.space[8], maxWidth: COLUMN, width: '100%' },
  notice: { ...v3.type.caption, color: v3.colors.danger, textAlign: 'center' },
  promise: {
    alignItems: 'center',
    backgroundColor: v3.colors.correctionTint,
    borderRadius: v3.radius.row,
    flexDirection: 'row',
    gap: v3.space[10],
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[10],
  },
  promiseText: { ...v3.type.callout, color: v3.colors.correction, flex: 1, fontWeight: '700' },
  terms: { ...v3.type.caption, color: v3.colors.muted, textAlign: 'center' },
  termsBilled: { color: v3.colors.fg, fontWeight: '700' },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  // A target a thumb can find, on words set small: the platform's minimum,
  // 48dp on Android rather than iOS's 44.
  link: {
    justifyContent: 'center',
    minHeight: ICON_BUTTON_TARGET,
    paddingHorizontal: v3.space[10],
  },
  linkText: { ...v3.type.label, color: v3.colors.muted },
}))
