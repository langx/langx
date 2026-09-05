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
import { ActivityIndicator, Linking, Platform, Pressable, Text, View } from 'react-native'
import { useEffectiveTier, useMe, useQuota, useRefreshEntitlement } from '../../src/api/queries'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
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
 * trial caption. A separate key rather than the label lower-cased: case is
 * not a string operation in every locale, and the two are different words in
 * most of them.
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

  const hasTopLines =
    (feature !== null && highlightTier !== null) || remaining === 0 || tier !== 'free'

  return (
    <Screen scroll>
      {/*
        Translated, unlike the plan names below it. "LangX Pro" named one of the
        two things this screen sells and would have read wrong above a Fluent
        and a Polyglot column. A screen heading is copy, not a brand mark.
      */}
      <ScreenHeader
        title={t('paywall.screenTitle')}
        onBack={() => goBackTo('/(app)/(tabs)/me', from)}
      />

      {/*
        Says why this screen opened, when the caller knew. Someone who just
        tapped a locked filter is answering a different question from someone
        who opened the paywall from their profile, and a generic pitch answers
        neither of them well.
      */}
      {hasTopLines ? (
        <View style={styles.topBlock}>
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

      {PAID_PLAN_TIERS.map((paidTier) => (
        <TierSection
          key={paidTier}
          tier={paidTier}
          offers={offers}
          held={held}
          busyOfferId={busyOfferId}
          onBuy={buy}
          onChangePlan={changePlanInPortal}
        />
      ))}

      {/*
        Required by Apple on any screen that sells a subscription, and it has to
        work for someone reinstalling on a new device — so it runs a real SDK
        restore, not only the server-side reconcile.
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
    </Screen>
  )
}

interface TierSectionProps {
  tier: PaidPlanTier
  offers: PurchaseOffer[] | null
  held: HeldPlan
  busyOfferId: string | null
  onBuy: (offerId: string, change: PlanChange) => Promise<void>
  onChangePlan: () => Promise<void>
}

function TierSection({ tier, offers, held, busyOfferId, onBuy, onChangePlan }: TierSectionProps) {
  const styles = useStyles()
  const t = useT()

  const tierOffers = offers?.filter((offer) => offer.tier === tier) ?? []
  /*
   * Was `currentTier === tier`, which disabled the plan held and nothing
   * else: a Polyglot subscriber could buy Fluent underneath it, and a Fluent
   * subscriber tapping Polyglot opened a second subscription beside the first
   * on Play and on the web. What a tap means depends on the tier *and* the
   * store that sold it, and `planChangeFor` is the one place that is decided.
   */
  const change = planChangeFor(held, tier, PLATFORM)
  const heldName = held.tier === 'free' ? '' : TIER_NAMES[held.tier]
  const boughtOn = platformOfStore(held.store)
  const isCurrent = change === 'covered' || change === 'elsewhere'
  // The web's upgrade is a portal, not a checkout — see `changePlanInPortal`.
  // Not under the harness, which has no portal and answers `PRODUCT_CHANGE`
  // to a second purchase the way a store would.
  const viaPortal = change === 'upgrade' && PLATFORM === 'web' && !isFakePurchasesEnabled()

  // The yearly plan is the screen's one committing (yellow) action; every
  // other offer is an outline. When the store returns no yearly, the first
  // offer inherits the slot so the screen never sells without a commit.
  const featured =
    tier === 'pro'
      ? (tierOffers.find((offer) => offer.period === 'yearly') ?? tierOffers[0])
      : undefined
  const orderedOffers = featured
    ? [featured, ...tierOffers.filter((offer) => offer !== featured)]
    : tierOffers

  const offerLabel = (offer: PurchaseOffer) =>
    t('paywall.offer', { period: t(PERIOD_LABEL[offer.period]), price: offer.priceString })
  const offerDisabled = (offer: PurchaseOffer) =>
    isCurrent || (busyOfferId !== null && busyOfferId !== offer.id)

  // What the yearly saving is measured against. Taken from the offers the store
  // just returned rather than from a constant — `planSaving.ts` says why.
  const monthly = tierOffers.find((offer) => offer.period === 'monthly')

  return (
    <View style={[styles.section, tier === 'pro_plus' && styles.sectionLast]}>
      {tier === 'pro' ? (
        <Text style={styles.tierName}>{TIER_NAMES.pro}</Text>
      ) : (
        <View style={styles.plusHead}>
          <Text style={styles.tierName}>{TIER_NAMES.pro_plus}</Text>
          <Text style={styles.plusTagline}>
            {t('paywall.everythingInPro', { plan: TIER_NAMES.pro })}
          </Text>
        </View>
      )}

      <View style={styles.benefits}>
        {tier === 'pro'
          ? PRO_BENEFITS.map((benefit) => <BenefitRow key={benefit} copy={BENEFIT_COPY[benefit]} />)
          : PRO_PLUS_BENEFITS.map((benefit) => {
              const copy = PRO_PLUS_BENEFIT_COPY[benefit]
              return <BenefitRow key={benefit} copy={copy} pending={!copy.shipped} />
            })}
      </View>

      {/*
        What the buttons below will do to the plan already held, said before
        the tap rather than discovered on the receipt. App Review 3.1.2 wants
        the terms beside the offer; a second subscription nobody meant to
        start is the failure the other three sentences prevent.
      */}
      {change === 'covered' && held.tier !== tier ? (
        <Text style={styles.changeNotice}>{t('paywall.includedIn', { plan: heldName })}</Text>
      ) : change === 'upgrade' && !viaPortal ? (
        <Text style={styles.changeNotice}>{t('paywall.upgradeNotice', { plan: heldName })}</Text>
      ) : viaPortal ? (
        <Text style={styles.changeNotice}>{t('paywall.upgradeWeb', { plan: heldName })}</Text>
      ) : change === 'elsewhere' && boughtOn ? (
        <Text style={styles.changeNotice}>
          {t('paywall.upgradeElsewhere', { plan: heldName, store: t(STORE_NAME[boughtOn]) })}
        </Text>
      ) : change === 'buy' && held.store === 'promotional' ? (
        <Text style={styles.changeNotice}>
          {t('paywall.lifetimeKept', { plan: heldName, plus: TIER_NAMES[tier] })}
        </Text>
      ) : null}

      {offers === null ? (
        <ActivityIndicator style={styles.offersLoading} />
      ) : tierOffers.length === 0 ? (
        <Text style={styles.unavailable}>
          {t(isPurchasesAvailable() ? 'paywall.noPlans' : 'paywall.notSetUp')}
        </Text>
      ) : viaPortal ? (
        <View style={styles.offerFirst}>
          <PlusOfferButton
            label={t('paywall.changePlan')}
            loading={false}
            disabled={busyOfferId !== null}
            onPress={() => void onChangePlan()}
          />
        </View>
      ) : tier === 'pro' ? (
        orderedOffers.map((offer, index) => (
          <View key={offer.id} style={index === 0 ? styles.offerFirst : styles.offerNext}>
            <OfferCaption offer={offer} monthly={monthly} />
            <Button
              label={offerLabel(offer)}
              variant={offer === featured ? 'primary' : 'secondary'}
              loading={busyOfferId === offer.id}
              disabled={offerDisabled(offer)}
              onPress={() => onBuy(offer.id, change)}
            />
          </View>
        ))
      ) : (
        orderedOffers.map((offer, index) => (
          <View key={offer.id} style={index === 0 ? styles.offerFirst : styles.offerNext}>
            <OfferCaption offer={offer} monthly={monthly} />
            <PlusOfferButton
              label={offerLabel(offer)}
              loading={busyOfferId === offer.id}
              disabled={offerDisabled(offer)}
              onPress={() => void onBuy(offer.id, change)}
            />
          </View>
        ))
      )}
    </View>
  )
}

/**
 * What the store is giving away, above the price rather than beside it.
 *
 * The trial comes first because it is the decision on offer: someone weighing a
 * year of anything wants to know they can leave before they want to know what
 * it costs. Neither line is written unless the store actually returned it — a
 * storefront with no trial, or a tier whose monthly price is missing, renders
 * the button on its own rather than a claim nobody can check.
 *
 * The two sit apart by `gap` rather than by a separator character, because a
 * punctuation mark between two sentences is a user-facing string, and those
 * live in `messages/en.ts` with the other seven locales typed against them.
 */
function OfferCaption({
  offer,
  monthly,
}: {
  offer: PurchaseOffer
  monthly: PurchaseOffer | undefined
}) {
  const styles = useStyles()
  const t = useT()

  const saving = yearlySavingPercent(offer, monthly)
  if (offer.freeTrialDays === null && saving === null) return null

  return (
    <View style={styles.caption}>
      {/*
        The whole sequence — how long the trial runs and what it renews at —
        beside the offer, not only in the footer's small print. App Review
        guideline 3.1.2 asks for the trial's own terms next to the trial.
      */}
      {offer.freeTrialDays !== null ? (
        <Text style={styles.captionTrial}>
          {t('paywall.trialTerms', {
            count: offer.freeTrialDays,
            price: offer.priceString,
            period: t(PERIOD_PHRASE[offer.period]),
          })}
        </Text>
      ) : null}
      {saving !== null ? (
        <Text style={styles.captionSaving}>{t('paywall.saving', { percent: saving })}</Text>
      ) : null}
    </View>
  )
}

/**
 * The Pro+ offer is an outline like the secondary `Button`, but ringed in
 * `text` rather than `border` — the design's way of saying "also real, not the
 * default" without spending a second yellow. `Button` cannot draw that ring
 * (its `style` lands on the animation wrapper, outside the bordered box), so
 * the pressable is local.
 */
function PlusOfferButton({
  label,
  loading,
  disabled,
  onPress,
}: {
  label: string
  loading: boolean
  disabled: boolean
  onPress: () => void
}) {
  const { colors } = useTheme()
  const styles = useStyles()
  const isDisabled = disabled || loading

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.plusOffer,
        isDisabled && styles.plusOfferDisabled,
        pressed && !isDisabled && styles.plusOfferPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <Text style={styles.plusOfferLabel}>{label}</Text>
      )}
    </Pressable>
  )
}

function BenefitRow({ copy, pending = false }: { copy: BenefitCopy; pending?: boolean }) {
  const { colors } = useTheme()
  const styles = useStyles()
  const t = useT()

  return (
    <View style={styles.benefit}>
      <Feather
        name="check"
        size={15}
        color={pending ? colors.textFaint : colors.accent}
        style={styles.check}
      />
      <Text style={[styles.benefitText, pending && styles.benefitTextPending]}>
        <Text style={[styles.benefitLead, pending && styles.benefitLeadPending]}>
          {t(copy.title)}
        </Text>
        <Text style={styles.benefitBody}>
          {' — '}
          {t(copy.body, copy.vars)}
        </Text>
        {pending ? <Text style={styles.pendingTag}> · {t('common.comingSoon')}</Text> : null}
      </Text>
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  topBlock: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    gap: spacing.sm,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  contextText: { color: colors.textMuted, fontSize: 14, lineHeight: 22 },
  contextFeature: { color: colors.accent, fontWeight: '700' },
  notice: { color: colors.danger, fontSize: 14, lineHeight: 22, marginTop: spacing.lg },

  section: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingBottom: spacing.lg + 4,
    paddingTop: spacing.lg + 2,
  },
  sectionLast: { borderBottomWidth: 0, paddingBottom: 0 },
  tierName: { ...font.heading, color: colors.text, fontSize: 22 },
  plusHead: { alignItems: 'baseline', flexDirection: 'row', gap: spacing.sm + 2 },
  plusTagline: { color: colors.textMuted, flex: 1, fontSize: 13, fontWeight: '600' },

  benefits: { gap: 9, marginTop: spacing.md },
  benefit: { flexDirection: 'row', gap: spacing.sm + 2 },
  check: { flexShrink: 0, marginTop: 3 },
  benefitText: { color: colors.text, flex: 1, fontSize: 15, lineHeight: 22 },
  benefitTextPending: { color: colors.textMuted },
  benefitLead: { fontWeight: '700' },
  // A not-yet-shipped feature keeps its name legible while the row around it
  // steps back — the name is the promise, the mute is the schedule.
  benefitLeadPending: { color: colors.text },
  benefitBody: { color: colors.textMuted, fontWeight: '400' },
  pendingTag: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },

  offerFirst: { marginTop: spacing.lg },
  offerNext: { marginTop: spacing.sm },
  // Inset to the pill's own curve, so the line reads as belonging to the button
  // under it rather than to the benefit list above.
  caption: {
    alignItems: 'baseline',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: 6,
    paddingHorizontal: spacing.md,
  },
  captionTrial: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  captionSaving: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  offersLoading: { marginTop: spacing.lg },
  unavailable: { color: colors.textMuted, fontSize: 14, lineHeight: 22, marginTop: spacing.lg },
  changeNotice: { color: colors.textMuted, fontSize: 13, lineHeight: 20, marginTop: spacing.md },

  plusOffer: {
    alignItems: 'center',
    borderColor: colors.text,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: spacing.xl,
    width: '100%',
  },
  plusOfferDisabled: { opacity: 0.5 },
  plusOfferPressed: { backgroundColor: colors.fill },
  plusOfferLabel: {
    color: colors.text,
    fontFamily: font.heading.fontFamily,
    fontSize: 15,
    fontWeight: '800',
  },

  restore: { marginTop: spacing.xl },
  restoreText: { color: colors.accent, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  legal: {
    color: colors.textFaint,
    fontSize: 12,
    lineHeight: 18,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  legalDot: { ...font.caption, color: colors.textFaint },
  legalLink: { ...font.caption, color: colors.accent, fontWeight: '600' },
  legalLinks: {
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.sm,
  },
}))
