import Feather from '@expo/vector-icons/Feather'
import {
  PAID_PLAN_TIERS,
  PLAN_FEATURES,
  PLAN_LIMITS,
  PRO_BENEFITS,
  PRO_PLUS_BENEFITS,
  planChangeFor,
  platformOfStore,
  tierUnlocking,
  type BillingPeriod,
  type BillingPlatform,
  type HeldPlan,
  type PaidPlanTier,
  type PlanChange,
  type PlanFeature,
  type ProBenefit,
  type ProPlusBenefit,
  TIER_NAMES,
} from '@langx/shared'
import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { useEffectiveTier, useMe, useQuota, useRefreshEntitlement } from '../../src/api/queries'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { SegmentedControl } from '../../src/components/ui/SegmentedControl'
import { track } from '../../src/lib/analytics'
import { goBackTo } from '../../src/lib/navigation'
import { isFakePurchasesEnabled } from '../../src/lib/fakePurchases'
import { yearlySavingPercent } from '../../src/lib/planSaving'
import {
  getOffers,
  isPurchasesAvailable,
  purchaseOffer,
  restorePurchases,
  storeManagementUrl,
  type PurchaseOffer,
} from '../../src/lib/purchases'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { PRIVACY_URL, TERMS_URL } from '../../src/lib/externalLinks'
import { useT, type MessageKey } from '../../src/i18n'
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

/** Where a plan bought elsewhere has to be changed, as the sentence names it. */
const STORE_NAME: Record<BillingPlatform, MessageKey> = {
  ios: 'paywall.storeIos',
  android: 'paywall.storeAndroid',
  web: 'paywall.storeWeb',
}

/** This build's store, in `planChangeFor`'s vocabulary. */
const PLATFORM: BillingPlatform =
  Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web'

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
 */
interface BenefitCopy {
  title: MessageKey
  body: MessageKey
  /**
   * Interpolated into `body`. Free-tier numbers come from `PLAN_LIMITS` rather
   * than being typed out, because a paywall quoting a limit the server no
   * longer enforces is the worst kind of wrong; plan names come from
   * `TIER_NAMES` for the same reason, one rename later.
   *
   * A bag rather than a bare `count` because a benefit can need both, and a
   * second optional field per placeholder is how the two drift apart.
   */
  vars?: Record<string, string | number>
}

const BENEFIT_COPY: Record<ProBenefit, BenefitCopy> = {
  unlimitedInitiations: {
    title: 'paywall.unlimitedChats',
    body: 'paywall.unlimitedChatsBody',
    vars: { count: PLAN_LIMITS.free.initiationsPer24h ?? 0 },
  },
  advancedFilters: {
    title: 'paywall.advancedFilters',
    body: 'paywall.advancedFiltersBody',
  },
  /*
   * Both of these are the *paid tier's* number, not the free one — unlike the
   * chat allowance above, which sells by naming the limit you are hitting.
   * Translation is no longer unlimited anywhere, so the honest pitch is how
   * much more you get, and that differs per column.
   */
  translationQuota: {
    title: 'paywall.translationQuota',
    body: 'paywall.translationQuotaBody',
    vars: { count: PLAN_LIMITS.pro.translationsPer24h },
  },
  learningLanguages: {
    title: 'paywall.learningLanguages',
    body: 'paywall.learningLanguagesBody',
    vars: { count: PLAN_LIMITS.pro.maxLearningLanguages },
  },
  welcomePack: {
    title: 'paywall.welcomePack',
    body: 'paywall.welcomePackBody',
    vars: { plan: TIER_NAMES.pro_plus },
  },
}

/**
 * The same contract for Pro+, plus one field the Pro list does not need.
 *
 * `shipped` exists because neither of these was built when the tier went on
 * sale. A tier can be sold before its features land, but a screen that
 * describes them in the present tense while they do nothing is selling
 * something that does not exist. Making it a required field means a feature
 * cannot ship quietly half-true: someone has to come back and flip it, which
 * is what happened to `nearby` and has not yet happened to `copilot`.
 */
const PRO_PLUS_BENEFIT_COPY: Record<ProPlusBenefit, BenefitCopy & { shipped: boolean }> = {
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
  // The same two benefits as the Fluent column, at the higher number. See the
  // note on `PRO_PLUS_BENEFITS` for why they are repeated rather than implied.
  translationQuota: {
    title: 'paywall.translationQuota',
    body: 'paywall.translationQuotaBody',
    vars: { count: PLAN_LIMITS.pro_plus.translationsPer24h },
    shipped: true,
  },
  learningLanguages: {
    title: 'paywall.learningLanguages',
    body: 'paywall.learningLanguagesBody',
    vars: { count: PLAN_LIMITS.pro_plus.maxLearningLanguages },
    shipped: true,
  },
  nearby: {
    // The body says what it does *and* what it costs the reader, because the
    // second half is the part they would otherwise find out after paying.
    title: 'paywall.nearby',
    body: 'paywall.nearbyBody',
    shipped: true,
  },
  copilot: {
    title: 'paywall.copilot',
    body: 'paywall.copilotBody',
    shipped: false,
  },
}

/**
 * Names for the contextual line, derived from the copy above rather than
 * retyped — the paywall must not call a capability one thing in its list and
 * another in the sentence explaining why the screen opened.
 *
 * `Record<PlanFeature, string>` is the enforcement: a capability added to
 * either feature list without a name here stops this file compiling.
 */
const FEATURE_TITLE: Record<PlanFeature, MessageKey> = {
  advancedFilters: BENEFIT_COPY.advancedFilters.title,
  profileViewerIdentities: PRO_PLUS_BENEFIT_COPY.profileViewerIdentities.title,
  incognito: PRO_PLUS_BENEFIT_COPY.incognito.title,
  nearby: PRO_PLUS_BENEFIT_COPY.nearby.title,
  copilot: PRO_PLUS_BENEFIT_COPY.copilot.title,
}

/** A route param is a string from anywhere — a deep link, a stale URL — so it is checked against the real list before being trusted as one. */
function parseFeature(raw: string | undefined): PlanFeature | null {
  if (!raw) return null
  return (PLAN_FEATURES as readonly string[]).includes(raw) ? (raw as PlanFeature) : null
}

export default function PaywallScreen() {
  useScreenInteractive()
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()

  // Reached from the profile, the viewer list, filters, Discover and a chat
  // thread, so the caller says where back leads.
  const { feature: featureParam, from } = useLocalSearchParams<{
    feature?: string
    from?: string
  }>()
  const feature = parseFeature(featureParam)
  // Which tier the context line points at, read off `PLAN_LIMITS` rather than
  // assumed: move a capability between tiers and the sentence follows it.
  const highlightTier = feature ? tierUnlocking(feature) : null
  const quota = useQuota()
  const refresh = useRefreshEntitlement()
  const tier = useEffectiveTier()
  const me = useMe()
  // The store beside the tier: the same tier is a swap, a second purchase or
  // a dead end depending on who sold it, and `planChangeFor` decides which.
  const held: HeldPlan = { tier, store: tier === 'free' ? null : me.data?.entitlement?.store }
  const remaining = quota.data?.initiations.remaining

  // `null` while the store is still being asked. Distinguishing that from "the
  // store said nothing" matters: one is a spinner, the other is the honest
  // "you cannot buy this right now" state below.
  const [offers, setOffers] = useState<PurchaseOffer[] | null>(null)
  const [busyOfferId, setBusyOfferId] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  // One plan and one period at a time, where the screen used to list every
  // offer of both tiers. It opens on the tier that unlocks what the caller was
  // just refused, so the context line and the price agree.
  const [plan, setPlan] = useState<PaidPlanTier>(highlightTier ?? 'pro')
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
    track({ name: 'paywall_viewed', properties: { feature: feature ?? null, tier } })
  }, [])

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
    const outcome = await purchaseOffer(offerId, change)
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

  /**
   * A web upgrade happens in RevenueCat's portal, not in a checkout: the
   * portal swaps the plan and refunds the unused time, which the SDK's
   * `purchase` cannot do — it would open a second subscription beside the
   * first. So the button goes there, and the tier follows on the next refresh.
   */
  async function changePlanInPortal(): Promise<void> {
    setNotice(null)
    const url = await storeManagementUrl()
    if (!url) {
      setNotice(t('paywall.purchaseUnavailable'))
      return
    }
    track({
      name: 'purchase_started',
      properties: { offer: 'portal', tier: 'pro_plus', period: null, change: 'portal' },
    })
    await Linking.openURL(url)
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

  const tierOffers = offers?.filter((offer) => offer.tier === plan) ?? []
  const periods = PERIOD_ORDER.filter((candidate) =>
    tierOffers.some((offer) => offer.period === candidate),
  )
  // Falls back to the first period this tier is sold in when the picked one is
  // not — a Polyglot without a monthly must not leave the price row empty.
  const period = pickedPeriod !== null && periods.includes(pickedPeriod) ? pickedPeriod : periods[0]
  const offer = tierOffers.find((candidate) => candidate.period === period)
  // What the yearly saving is measured against. Taken from the offers the store
  // just returned rather than from a constant — `planSaving.ts` says why.
  const yearly = tierOffers.find((candidate) => candidate.period === 'yearly')
  const monthly = tierOffers.find((candidate) => candidate.period === 'monthly')
  const saving = yearly ? yearlySavingPercent(yearly, monthly) : null

  /*
   * Was `currentTier === tier`, which disabled the plan held and nothing
   * else: a Polyglot subscriber could buy Fluent underneath it, and a Fluent
   * subscriber tapping Polyglot opened a second subscription beside the first
   * on Play and on the web. What a tap means depends on the tier *and* the
   * store that sold it, and `planChangeFor` is the one place that is decided.
   */
  const change = planChangeFor(held, plan, PLATFORM)
  const heldName = held.tier === 'free' ? '' : TIER_NAMES[held.tier]
  const boughtOn = platformOfStore(held.store)
  const isCurrent = change === 'covered' || change === 'elsewhere'
  // The web's upgrade is a portal, not a checkout — see `changePlanInPortal`.
  // Not under the harness, which has no portal and answers `PRODUCT_CHANGE`
  // to a second purchase the way a store would.
  const viaPortal = change === 'upgrade' && PLATFORM === 'web' && !isFakePurchasesEnabled()
  // The higher tier's ticks take the brand purple; the first tier's stay blue.
  const tint = plan === 'pro_plus' ? colors.pro : colors.accent

  /*
   * What the button below will do to the plan already held, said before the
   * tap rather than discovered on the receipt. App Review 3.1.2 wants the
   * terms beside the offer; a second subscription nobody meant to start is
   * the failure the other sentences prevent.
   */
  const changeNotice =
    change === 'covered' && held.tier !== plan
      ? t('paywall.includedIn', { plan: heldName })
      : change === 'upgrade' && !viaPortal
        ? t('paywall.upgradeNotice', { plan: heldName })
        : viaPortal
          ? t('paywall.upgradeWeb', { plan: heldName })
          : change === 'elsewhere' && boughtOn
            ? t('paywall.upgradeElsewhere', { plan: heldName, store: t(STORE_NAME[boughtOn]) })
            : change === 'buy' && held.store === 'promotional'
              ? t('paywall.lifetimeKept', { plan: heldName, plus: TIER_NAMES[plan] })
              : null

  const hasTopLines =
    (feature !== null && highlightTier !== null) || remaining === 0 || tier !== 'free'

  return (
    <Screen fluid style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.backPlain')}
          hitSlop={12}
          onPress={() => goBackTo('/(app)/(tabs)/me', from)}
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
            {feature && highlightTier ? (
              <Text style={styles.contextText}>
                <Text style={styles.contextFeature}>{t(FEATURE_TITLE[feature])}</Text>{' '}
                {t('paywall.partOf')} {TIER_NAMES[highlightTier]}.
              </Text>
            ) : null}
            {remaining === 0 ? (
              <Text style={styles.contextText}>
                {t('paywall.quotaNotice', { count: PLAN_LIMITS.free.initiationsPer24h ?? 0 })}
              </Text>
            ) : null}
            {tier !== 'free' ? (
              <Text style={styles.contextText}>
                {held.store === 'promotional'
                  ? t('paywall.lifetimeNotice', { plan: TIER_NAMES[tier] })
                  : t('paywall.manageNotice', { plan: TIER_NAMES[tier] })}
              </Text>
            ) : null}
          </View>
        ) : null}

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <SegmentedControl
          options={PAID_PLAN_TIERS.map((paidTier) => ({
            value: paidTier,
            label: TIER_NAMES[paidTier],
          }))}
          selected={[plan]}
          onToggle={setPlan}
          accessibilityLabel={t('paywall.screenTitle')}
        />

        {/* One period is no choice, so the control only appears with two. */}
        {periods.length > 1 ? (
          <SegmentedControl
            options={periods.map((candidate) => ({
              value: candidate,
              label:
                candidate === 'yearly' && saving !== null
                  ? t('paywall.yearlySaving', { percent: saving })
                  : t(PERIOD_LABEL[candidate]),
            }))}
            selected={period ? [period] : []}
            onToggle={setPickedPeriod}
            accessibilityLabel={t('paywall.billingPeriod')}
          />
        ) : null}

        {offers === null ? (
          <ActivityIndicator style={styles.priceLoading} />
        ) : offer ? (
          <View style={styles.priceBlock}>
            {/*
              A yearly plan leads with what it costs a month, as the design
              does — the store's own per-month string, never a division done
              here — and says how it is billed. Without one from the store the
              row falls back to the charge and its period. The trial terms
              below always quote the charge itself.
            */}
            <View style={styles.priceRow}>
              {offer.period === 'yearly' && offer.perMonthPriceString ? (
                <>
                  <Text style={styles.price}>{offer.perMonthPriceString}</Text>
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
              The whole sequence — how long the trial runs and what it renews
              at — beside the price, not only in the footer's small print. App
              Review guideline 3.1.2 asks for the trial's own terms next to the
              trial. Not written unless the store actually returned one.
            */}
            {offer.freeTrialDays !== null ? (
              <Text style={styles.trial}>
                {t('paywall.trialTerms', {
                  count: offer.freeTrialDays,
                  price: offer.priceString,
                  period: t(PERIOD_PHRASE[offer.period]),
                })}
              </Text>
            ) : null}
            {changeNotice ? <Text style={styles.changeNotice}>{changeNotice}</Text> : null}
          </View>
        ) : (
          <Text style={styles.unavailable}>
            {t(isPurchasesAvailable() ? 'paywall.noPlans' : 'paywall.notSetUp')}
          </Text>
        )}

        <View style={styles.features}>
          {plan === 'pro'
            ? PRO_BENEFITS.map((benefit) => (
                <FeatureRow key={benefit} copy={BENEFIT_COPY[benefit]} tint={tint} />
              ))
            : PRO_PLUS_BENEFITS.map((benefit) => {
                const copy = PRO_PLUS_BENEFIT_COPY[benefit]
                return <FeatureRow key={benefit} copy={copy} tint={tint} soon={!copy.shipped} />
              })}
          {/* The superset relationship, as the last row rather than a tagline. */}
          {plan === 'pro_plus' ? (
            <View style={styles.feature}>
              <Feather name="check" size={18} color={tint} />
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>
                  {t('paywall.everythingInPro', { plan: TIER_NAMES.pro })}
                </Text>
              </View>
            </View>
          ) : null}
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
            viaPortal ? t('paywall.changePlan') : t('paywall.start', { plan: TIER_NAMES[plan] })
          }
          loading={offers === null || busyOfferId !== null}
          disabled={isCurrent || offer === undefined}
          onPress={() =>
            viaPortal ? changePlanInPortal() : offer ? buy(offer.id, change) : undefined
          }
        />
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

  priceLoading: { paddingTop: 6 },
  priceBlock: { gap: spacing.sm, paddingTop: 6 },
  priceRow: { alignItems: 'baseline', flexDirection: 'row', gap: spacing.sm },
  price: { ...font.heading, color: colors.text, fontSize: 44 },
  per: { color: colors.textMuted, fontSize: 15 },
  trial: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  changeNotice: { color: colors.textMuted, fontSize: 13, lineHeight: 20 },
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
