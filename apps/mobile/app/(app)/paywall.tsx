import Feather from '@expo/vector-icons/Feather'
import {
  PAID_PLAN_TIERS,
  PLAN_FEATURES,
  PLAN_LIMITS,
  PRO_BENEFITS,
  PRO_PLUS_BENEFITS,
  tierUnlocking,
  type BillingPeriod,
  type PaidPlanTier,
  type PlanFeature,
  type ProBenefit,
  type ProPlusBenefit,
  TIER_NAMES,
} from '@langx/shared'
import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native'
import { useEffectiveTier, useQuota, useRefreshEntitlement } from '../../src/api/queries'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { goBackTo } from '../../src/lib/navigation'
import {
  getOffers,
  isPurchasesAvailable,
  purchaseOffer,
  restorePurchases,
  type PurchaseOffer,
} from '../../src/lib/purchases'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { useT, type MessageKey } from '../../src/i18n'

/**
 * Both dated 7 June 2024 and, per `architecture.md:101`, **still missing the
 * subscription clauses** — renewal, cancellation, the token's
 * non-transferability. Linking to them is required on a screen that sells a
 * subscription; the documents themselves have to be updated before this ships
 * to a store, and that is a writing task, not a code one.
 */
const TERMS_URL = 'https://langx.io/terms-conditions'
const PRIVACY_URL = 'https://langx.io/privacy-policy'

const PERIOD_LABEL: Record<BillingPeriod, MessageKey> = {
  monthly: 'paywall.monthly',
  yearly: 'paywall.yearly',
  lifetime: 'paywall.lifetime',
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
  unlimitedTranslation: {
    title: 'paywall.unlimitedTranslation',
    body: 'paywall.unlimitedTranslationBody',
    vars: { count: PLAN_LIMITS.free.translationsPer24h ?? 0 },
  },
  profileViewerIdentities: {
    title: 'paywall.whoViewed',
    body: 'paywall.whoViewedBody',
  },
  incognito: {
    title: 'paywall.incognito',
    body: 'paywall.incognitoBody',
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
  profileViewerIdentities: BENEFIT_COPY.profileViewerIdentities.title,
  incognito: BENEFIT_COPY.incognito.title,
  nearby: PRO_PLUS_BENEFIT_COPY.nearby.title,
  copilot: PRO_PLUS_BENEFIT_COPY.copilot.title,
}

/** A route param is a string from anywhere — a deep link, a stale URL — so it is checked against the real list before being trusted as one. */
function parseFeature(raw: string | undefined): PlanFeature | null {
  if (!raw) return null
  return (PLAN_FEATURES as readonly string[]).includes(raw) ? (raw as PlanFeature) : null
}

export default function PaywallScreen() {
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

  async function buy(offerId: string): Promise<void> {
    setNotice(null)
    setBusyOfferId(offerId)
    const outcome = await purchaseOffer(offerId)
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

  const hasTopLines =
    (feature !== null && highlightTier !== null) || remaining === 0 || tier !== 'free'

  return (
    <Screen scroll>
      {/*
        Translated, unlike the plan names below it. "LangX Pro" named one of the
        two things this screen sells and would have read wrong above a Fluent
        and a Polyglot column. A screen heading is copy, not a brand mark.
      */}
      <ScreenHeader title={t('paywall.screenTitle')} onBack={() => goBackTo('/(app)/me', from)} />

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
              {t('paywall.manageNotice', { plan: TIER_NAMES[tier] })}
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
          currentTier={tier}
          busyOfferId={busyOfferId}
          onBuy={buy}
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
  currentTier: string
  busyOfferId: string | null
  onBuy: (offerId: string) => Promise<void>
}

function TierSection({ tier, offers, currentTier, busyOfferId, onBuy }: TierSectionProps) {
  const styles = useStyles()
  const t = useT()

  const tierOffers = offers?.filter((offer) => offer.tier === tier) ?? []
  const isCurrent = currentTier === tier

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

      {offers === null ? (
        <ActivityIndicator style={styles.offersLoading} />
      ) : tierOffers.length === 0 ? (
        <Text style={styles.unavailable}>
          {t(isPurchasesAvailable() ? 'paywall.noPlans' : 'paywall.notSetUp')}
        </Text>
      ) : tier === 'pro' ? (
        orderedOffers.map((offer, index) => (
          <Button
            key={offer.id}
            label={offerLabel(offer)}
            variant={offer === featured ? 'primary' : 'secondary'}
            loading={busyOfferId === offer.id}
            disabled={offerDisabled(offer)}
            onPress={() => onBuy(offer.id)}
            style={index === 0 ? styles.offerFirst : styles.offerNext}
          />
        ))
      ) : (
        orderedOffers.map((offer, index) => (
          <PlusOfferButton
            key={offer.id}
            label={offerLabel(offer)}
            loading={busyOfferId === offer.id}
            disabled={offerDisabled(offer)}
            onPress={() => void onBuy(offer.id)}
            first={index === 0}
          />
        ))
      )}
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
  first,
  onPress,
}: {
  label: string
  loading: boolean
  disabled: boolean
  first: boolean
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
        first ? styles.offerFirst : styles.offerNext,
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
  offersLoading: { marginTop: spacing.lg },
  unavailable: { color: colors.textMuted, fontSize: 14, lineHeight: 22, marginTop: spacing.lg },

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
