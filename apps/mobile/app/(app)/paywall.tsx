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
  TIER_NAMES,
} from '@langx/shared'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Linking, Pressable, ScrollView, Text, View } from 'react-native'
import { useEffectiveTier, useMe, useQuota, useRefreshEntitlement } from '../../src/api/queries'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { Skeleton } from '../../src/components/ui/Skeleton'
import { SegmentedControl } from '../../src/components/ui/SegmentedControl'
import { track } from '../../src/lib/analytics'
import { PAYWALL_SOURCES, type PaywallSource } from '../../src/lib/analyticsEvents'
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
import { makeStyles, useTheme } from '../../src/lib/theme'
import { PRIVACY_URL, TERMS_URL } from '../../src/lib/externalLinks'
import { useLocale, useT, type MessageKey } from '../../src/i18n'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

const PERIOD_LABEL: Record<BillingPeriod, MessageKey> = {
  monthly: 'paywall.monthly',
  yearly: 'paywall.yearly',
  lifetime: 'paywall.lifetime',
}

/**
 * The order the period segment offers them in. Yearly leads, as the featured
 * slot used to: it is the one the saving is measured on. Lifetime last, if a
 * store ever returns one.
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
    vars: { count: PLAN_LIMITS.free.initiationsPer24h ?? 0 },
    shipped: true,
  },
  advancedFilters: {
    title: 'paywall.advancedFilters',
    body: 'paywall.advancedFiltersBody',
    shipped: true,
  },
  boostedProfile: {
    title: 'paywall.boostedProfile',
    body: 'paywall.boostedProfileBody',
    shipped: true,
  },
  profileViewerIdentities: {
    title: 'paywall.whoViewed',
    body: 'paywall.whoViewedBody',
    shipped: true,
  },
  incognito: {
    title: 'paywall.incognito',
    body: 'paywall.incognitoBody',
    shipped: true,
  },
  nearby: {
    // The body says what it does *and* what it costs the reader, because the
    // second half is the part they would otherwise find out after paying.
    title: 'paywall.nearby',
    body: 'paywall.nearbyBody',
    shipped: true,
  },
  sendTranslation: {
    title: 'paywall.sendTranslation',
    body: 'paywall.sendTranslationBody',
    shipped: true,
  },
  deckExport: {
    title: 'paywall.deckExport',
    body: 'paywall.deckExportBody',
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
    vars: { count: PLAN_LIMITS.pro.translationsPer24h },
    shipped: true,
  },
  learningLanguages: {
    title: 'paywall.learningLanguages',
    body: 'paywall.learningLanguagesBody',
    vars: { count: PLAN_LIMITS.pro.maxLearningLanguages },
    shipped: true,
  },
  copilot: {
    title: 'paywall.copilot',
    body: 'paywall.copilotBody',
    shipped: false,
  },
  welcomePack: {
    title: 'paywall.welcomePack',
    body: 'paywall.welcomePackBody',
    shipped: true,
  },
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

export default function PaywallScreen() {
  useScreenInteractive()
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()
  const { locale: activeLocale } = useLocale()

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

  useEffect(() => {
    let cancelled = false
    void getOffers().then((result) => {
      if (!cancelled) setOffers(result)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Once per opening, with what sent them here. The paywall is the end of the
  // funnel, and which capability people hit it from is the question. Mount
  // only: the tier changing after a purchase is not a second viewing.
  useEffect(() => {
    track({ name: 'paywall_viewed', properties: { feature: feature ?? null, tier, source } })
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

  const tierOffers = offers?.filter((offer) => offer.tier === 'pro') ?? []
  const periods = PERIOD_ORDER.filter((candidate) =>
    tierOffers.some((offer) => offer.period === candidate),
  )
  // Falls back to the first period sold when the picked one is not — a store
  // without a monthly must not leave the price row empty.
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
  // A yearly plan's headline: truncated so the `.99` the price was chosen for
  // survives, with the store's rounded text only as a fallback.
  const perMonth =
    offer?.period === 'yearly'
      ? (perMonthPriceString(offer.priceString, offer.price) ?? offer.perMonthPriceString)
      : undefined

  const boughtOn = platformOfStore(held.store)
  const gift = tier !== 'free' && held.store === 'gift' && Boolean(held.expiresAt)
  const isCurrent = change === 'covered'
  const tint = colors.pro
  /*
   * A trial said in weeks when it is whole weeks — "1 week free", as the stores
   * sell it — and in days otherwise. `null` over a plan already held, and when
   * the store did not offer one (`ineligibleForTrial` leaves it out for
   * somebody who has had it).
   */
  const trialWeeks =
    offer?.freeTrialDays && !isCurrent && offer.freeTrialDays % 7 === 0
      ? offer.freeTrialDays / 7
      : null

  const hasTopLines = refused !== null || remaining === 0 || tier !== 'free'

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
        <Text style={styles.headline}>{t('paywall.headline')}</Text>
        <Text style={styles.lead}>{t('paywall.headlineBody')}</Text>

        {/*
          Says why this screen opened, when the caller knew. Someone who just
          tapped a locked filter is answering a different question from someone
          who opened the paywall from their profile, and a generic pitch answers
          neither of them well.
        */}
        {hasTopLines ? (
          <View style={styles.context}>
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
                  date: new Date(held.expiresAt as string).toLocaleDateString(activeLocale),
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
          </View>
        ) : null}

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        {/* One period is no choice, so the control only appears with two. */}
        {periods.length > 1 ? (
          <SegmentedControl
            options={periods.map((candidate) => ({
              value: candidate,
              label:
                candidate === 'yearly' && freeMonths !== null
                  ? t('paywall.yearlyFreeMonths', { count: freeMonths })
                  : candidate === 'yearly' && saving !== null
                    ? t('paywall.yearlySaving', { percent: saving })
                    : t(PERIOD_LABEL[candidate]),
            }))}
            selected={period ? [period] : []}
            onToggle={setPickedPeriod}
            accessibilityLabel={t('paywall.billingPeriod')}
          />
        ) : null}

        {offers === null ? (
          // The price's own line height, so the sheet does not jump when the
          // store answers — the number below is 44pt.
          <View style={styles.priceLoading}>
            <Skeleton width={148} height={44} />
            <Skeleton width={196} height={13} />
          </View>
        ) : offer ? (
          <View style={styles.priceBlock}>
            {/*
              A yearly plan leads with what it costs a month, as the design
              does — see `perMonthPriceString` for why it is truncated — and
              says how it is billed. Without one the row falls back to the
              charge and its period. The trial terms below always quote the
              charge itself.
            */}
            <View style={styles.priceRow}>
              {perMonth ? (
                <>
                  <Text style={styles.price}>{perMonth}</Text>
                  <Text style={styles.per}>{t('paywall.perMonthBilledYearly')}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.price}>{offer.priceString}</Text>
                  <Text style={styles.per}>{t(PERIOD_PHRASE[offer.period])}</Text>
                </>
              )}
            </View>
            {/*
              What the year saves, beside the month it is measured against.
              The segment label already carried the percentage, and nobody read
              it there: the monthly price struck through under the yearly one
              is what makes the discount a number someone can check.
            */}
            {offer.period === 'yearly' && (freeMonths !== null || saving !== null) && monthly ? (
              <View
                accessible
                accessibilityLabel={
                  freeMonths !== null
                    ? t('paywall.freeMonthsA11y', {
                        count: freeMonths,
                        price: monthly.priceString,
                      })
                    : t('paywall.savingA11y', { percent: saving ?? 0, price: monthly.priceString })
                }
                style={styles.savingRow}
              >
                <Text style={styles.wasPrice}>{monthly.priceString}</Text>
                <Text style={[styles.savingTag, { color: tint }]}>
                  {freeMonths !== null
                    ? t('paywall.freeMonths', { count: freeMonths })
                    : t('paywall.savePercent', { percent: saving ?? 0 })}
                </Text>
              </View>
            ) : null}
            {/*
              The whole sequence — how long the trial runs and what it renews
              at — beside the price, not only in the footer's small print. App
              Review guideline 3.1.2 asks for the trial's own terms next to the
              trial. Not written unless the store actually returned one, nor
              over a plan the reader already has and cannot start a trial of.
            */}
            {offer.freeTrialDays !== null && !isCurrent ? (
              <Text style={styles.trial}>
                {trialWeeks !== null
                  ? t('paywall.trialWeeks', {
                      count: trialWeeks,
                      price: offer.priceString,
                      period: t(PERIOD_PHRASE[offer.period]),
                    })
                  : t('paywall.trialTerms', {
                      count: offer.freeTrialDays,
                      price: offer.priceString,
                      period: t(PERIOD_PHRASE[offer.period]),
                    })}
              </Text>
            ) : null}
          </View>
        ) : (
          <Text style={styles.unavailable}>
            {t(isPurchasesAvailable() ? 'paywall.noPlans' : 'paywall.notSetUp')}
          </Text>
        )}

        <View style={styles.features}>
          {PRO_BENEFITS.map((benefit) => {
            const copy = BENEFIT_COPY[benefit]
            return <FeatureRow key={benefit} copy={copy} tint={tint} soon={!copy.shipped} />
          })}
        </View>

        <View style={styles.footnote}>
          <Text style={styles.legal}>{t('paywall.legal')}</Text>
          <View style={styles.legalLinks}>
            <Pressable onPress={() => void Linking.openURL(TERMS_URL)} hitSlop={8}>
              <Text style={styles.legalLink}>{t('paywall.terms')}</Text>
            </Pressable>
            <Text style={styles.legalDot}>·</Text>
            <Pressable onPress={() => void Linking.openURL(PRIVACY_URL)} hitSlop={8}>
              <Text style={styles.legalLink}>{t('paywall.privacy')}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={
            // The plan held, said plainly, rather than a greyed-out "Start".
            // A free week says so on the button, which is what the tap starts.
            isCurrent
              ? t('paywall.currentPlan')
              : trialWeeks !== null
                ? t('paywall.startTrial', { count: trialWeeks })
                : t('paywall.start', { plan: TIER_NAMES.pro })
          }
          loading={offers === null || busyOfferId !== null}
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
      </View>
    </Screen>
  )
}

/**
 * One benefit: a tick in the plan's colour, the name, and the number it comes
 * with underneath — the limit is the part of the promise worth keeping visible.
 * A not-yet-shipped feature keeps its name and body but wears the tag.
 */
function FeatureRow({
  copy,
  tint,
  soon = false,
}: {
  copy: BenefitCopy
  tint: string
  soon?: boolean
}) {
  const styles = useStyles()
  const t = useT()

  return (
    <View style={styles.feature}>
      <Feather name="check" size={18} color={tint} />
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{t(copy.title)}</Text>
        <Text style={styles.featureBody}>{t(copy.body, copy.vars)}</Text>
      </View>
      {soon ? <Text style={styles.soonTag}>{t('common.comingSoon')}</Text> : null}
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  // The header and footer hairlines run edge to edge, so the screen's gutter
  // moves onto the three blocks themselves — the same shape as the chat screen.
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
  content: { gap: 20, paddingHorizontal: 20 },
  headline: { ...font.title, color: colors.text, lineHeight: 36 },
  lead: { color: colors.textMuted, fontSize: 16, lineHeight: 24 },
  context: { gap: spacing.sm },
  contextText: { color: colors.textMuted, fontSize: 14, lineHeight: 22 },
  contextFeature: { color: colors.accent, fontWeight: '700' },
  notice: { color: colors.danger, fontSize: 14, lineHeight: 22 },

  priceLoading: { gap: spacing.sm, paddingTop: 6 },
  priceBlock: { gap: spacing.sm, paddingTop: 6 },
  priceRow: { alignItems: 'baseline', flexDirection: 'row', gap: spacing.sm },
  price: { ...font.heading, color: colors.text, fontSize: 44 },
  per: { color: colors.textMuted, fontSize: 15 },
  savingRow: { alignItems: 'baseline', flexDirection: 'row', gap: spacing.sm },
  wasPrice: { color: colors.textMuted, fontSize: 15, textDecorationLine: 'line-through' },
  savingTag: { fontSize: 15, fontWeight: '700' },
  trial: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  unavailable: { color: colors.textMuted, fontSize: 14, lineHeight: 22, paddingTop: 6 },

  features: { borderTopColor: colors.border, borderTopWidth: 1 },
  feature: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 14,
    paddingVertical: 13,
  },
  featureText: { flex: 1, gap: 2 },
  featureTitle: { color: colors.text, fontSize: 16 },
  featureBody: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
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

  footnote: { gap: spacing.sm, paddingBottom: spacing.md },
  legal: { color: colors.textFaint, fontSize: 13, lineHeight: 20 },
  legalLinks: { flexDirection: 'row', gap: spacing.sm },
  legalLink: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  legalDot: { color: colors.textFaint, fontSize: 13 },

  footer: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingBottom: 28,
    paddingHorizontal: 20,
    paddingTop: spacing.md,
  },
}))
