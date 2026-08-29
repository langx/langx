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
} from '@langx/shared'
import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native'
import { useEffectiveTier, useQuota, useRefreshEntitlement } from '../../src/api/queries'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { goBackTo } from '../../src/lib/navigation'
import {
  getOffers,
  isPurchasesAvailable,
  purchaseOffer,
  restorePurchases,
  type PurchaseOffer,
} from '../../src/lib/purchases'
import { makeStyles } from '../../src/lib/theme'
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
 * `name` is a brand — "Pro" and "Pro+" are the same words in every locale, and
 * they are what the store listing and the receipt say — so only the tagline is
 * a key.
 */
const TIER_COPY: Record<PaidPlanTier, { name: string; tagline: MessageKey }> = {
  pro: { name: 'Pro', tagline: 'paywall.proTagline' },
  pro_plus: { name: 'Pro+', tagline: 'paywall.proPlusTagline' },
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
 * The free-tier numbers come from `PLAN_LIMITS` rather than being typed out,
 * because a paywall quoting a limit the server no longer enforces is the worst
 * kind of wrong.
 */
interface BenefitCopy {
  emoji: string
  title: MessageKey
  body: MessageKey
  /** Interpolated into `body`. The free-tier numbers come from `PLAN_LIMITS`
   *  rather than being typed out, because a paywall quoting a limit the server
   *  no longer enforces is the worst kind of wrong. */
  count?: number
}

const BENEFIT_COPY: Record<ProBenefit, BenefitCopy> = {
  unlimitedInitiations: {
    emoji: '💬',
    title: 'paywall.unlimitedChats',
    body: 'paywall.unlimitedChatsBody',
    count: PLAN_LIMITS.free.initiationsPer24h ?? 0,
  },
  advancedFilters: {
    emoji: '🎯',
    title: 'paywall.advancedFilters',
    body: 'paywall.advancedFiltersBody',
  },
  unlimitedTranslation: {
    emoji: '🌍',
    title: 'paywall.unlimitedTranslation',
    body: 'paywall.unlimitedTranslationBody',
    count: PLAN_LIMITS.free.translationsPer24h ?? 0,
  },
  profileViewerIdentities: {
    emoji: '👀',
    title: 'paywall.whoViewed',
    body: 'paywall.whoViewedBody',
  },
  incognito: {
    emoji: '🕶️',
    title: 'paywall.incognito',
    body: 'paywall.incognitoBody',
  },
  hideOnlineStatus: {
    emoji: '🌙',
    title: 'paywall.hideOnline',
    body: 'paywall.hideOnlineBody',
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
    emoji: '📍',
    // The body says what it does *and* what it costs the reader, because the
    // second half is the part they would otherwise find out after paying.
    title: 'paywall.nearby',
    body: 'paywall.nearbyBody',
    shipped: true,
  },
  copilot: {
    emoji: '🤖',
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
  hideOnlineStatus: BENEFIT_COPY.hideOnlineStatus.title,
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
  // Which column to point at, read off `PLAN_LIMITS` rather than assumed:
  // move a capability between tiers and the sentence follows it.
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

  return (
    <Screen scroll>
      <Text style={styles.eyebrow}>LANGX</Text>
      <Text style={styles.title}>{t('paywall.title')}</Text>

      {/*
        Says why this screen opened, when the caller knew. Someone who just
        tapped a locked filter is answering a different question from someone
        who opened the paywall from their profile, and a generic pitch answers
        neither of them well.
      */}
      {feature && highlightTier ? (
        <View style={styles.contextBanner}>
          <Text style={styles.contextText}>
            {t(FEATURE_TITLE[feature])} {t('paywall.partOf')} {TIER_COPY[highlightTier].name}.
          </Text>
        </View>
      ) : null}

      {remaining === 0 ? (
        <View style={styles.quotaBanner}>
          <Text style={styles.quotaText}>
            {t('paywall.quotaNotice', { count: PLAN_LIMITS.free.initiationsPer24h ?? 0 })}
          </Text>
        </View>
      ) : null}

      {tier !== 'free' ? (
        <View style={styles.currentBanner}>
          <Text style={styles.currentText}>
            {t('paywall.manageNotice', { plan: TIER_COPY[tier].name })}
          </Text>
        </View>
      ) : null}

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      {PAID_PLAN_TIERS.map((paidTier) => (
        <TierCard
          key={paidTier}
          tier={paidTier}
          offers={offers}
          currentTier={tier}
          highlighted={highlightTier === paidTier}
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
        onPress={() => void restore()}
        disabled={restoring}
        hitSlop={8}
        style={styles.restore}
      >
        <Text style={styles.restoreText}>
          {restoring || refresh.isPending ? t('common.checking') : t('paywall.restore')}
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

      <Button
        label={t('common.backPlain')}
        variant="secondary"
        onPress={() => goBackTo('/(app)/me', from)}
        style={styles.back}
      />
    </Screen>
  )
}

interface TierCardProps {
  tier: PaidPlanTier
  offers: PurchaseOffer[] | null
  currentTier: string
  /** The tier that unlocks whatever sent the user here, if anything did. */
  highlighted: boolean
  busyOfferId: string | null
  onBuy: (offerId: string) => Promise<void>
}

function TierCard({ tier, offers, currentTier, highlighted, busyOfferId, onBuy }: TierCardProps) {
  const styles = useStyles()
  const t = useT()

  const copy = TIER_COPY[tier]
  const tierOffers = offers?.filter((offer) => offer.tier === tier) ?? []
  const isCurrent = currentTier === tier

  return (
    <View
      style={[
        styles.card,
        tier === 'pro_plus' && styles.cardPlus,
        highlighted && styles.cardHighlighted,
      ]}
    >
      <Text style={[styles.cardTitle, tier === 'pro_plus' && styles.cardTitlePlus]}>
        {copy.name}
      </Text>
      <Text style={styles.cardTagline}>{t(copy.tagline)}</Text>

      {tier === 'pro'
        ? PRO_BENEFITS.map((benefit) => {
            const feature = BENEFIT_COPY[benefit]
            return <BenefitRow key={benefit} copy={feature} />
          })
        : PRO_PLUS_BENEFITS.map((benefit) => {
            const feature = PRO_PLUS_BENEFIT_COPY[benefit]
            return <BenefitRow key={benefit} copy={feature} pending={!feature.shipped} />
          })}

      {offers === null ? (
        <ActivityIndicator style={styles.offersLoading} />
      ) : tierOffers.length === 0 ? (
        <Text style={styles.unavailable}>
          {t(isPurchasesAvailable() ? 'paywall.noPlans' : 'paywall.notSetUp')}
        </Text>
      ) : (
        tierOffers.map((offer) => (
          <Button
            key={offer.id}
            label={t('paywall.offer', {
              period: t(PERIOD_LABEL[offer.period]),
              price: offer.priceString,
            })}
            variant={tier === 'pro_plus' ? 'primary' : 'secondary'}
            loading={busyOfferId === offer.id}
            disabled={isCurrent || (busyOfferId !== null && busyOfferId !== offer.id)}
            onPress={() => onBuy(offer.id)}
            style={styles.offerButton}
          />
        ))
      )}
    </View>
  )
}

function BenefitRow({ copy, pending = false }: { copy: BenefitCopy; pending?: boolean }) {
  const styles = useStyles()
  const t = useT()

  return (
    <View style={styles.feature}>
      <Text style={styles.emoji}>{copy.emoji}</Text>
      <View style={styles.featureBody}>
        <View style={styles.featureTitleRow}>
          <Text style={styles.featureTitle}>{t(copy.title)}</Text>
          {pending ? <Text style={styles.pendingTag}>{t('common.comingSoon')}</Text> : null}
        </View>
        <Text style={styles.featureText}>
          {t(copy.body, copy.count === undefined ? undefined : { count: copy.count })}
        </Text>
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  back: { marginBottom: spacing.xl, marginTop: spacing.lg },
  card: {
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.lg,
  },
  cardHighlighted: { backgroundColor: colors.surface, borderColor: colors.accent, borderWidth: 2 },
  cardPlus: { borderColor: colors.proPlus, borderWidth: 2 },
  cardTagline: { ...font.caption, color: colors.textMuted, marginTop: spacing.xs },
  contextBanner: {
    backgroundColor: colors.surface,
    borderStartColor: colors.accent,
    borderStartWidth: 3,
    borderRadius: radius.md,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  contextText: { ...font.caption, color: colors.text },
  cardTitle: { ...font.heading, color: colors.pro },
  cardTitlePlus: { color: colors.proPlus },
  currentBanner: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  currentText: { ...font.caption, color: colors.text },
  emoji: { fontSize: 20, marginEnd: spacing.md },
  eyebrow: { ...font.label, color: colors.pro, letterSpacing: 1, marginTop: spacing.lg },
  feature: { flexDirection: 'row', marginTop: spacing.lg },
  featureBody: { flex: 1 },
  featureText: { ...font.caption, color: colors.textMuted, marginTop: 2 },
  featureTitle: { ...font.body, fontWeight: '600' },
  featureTitleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  legal: { ...font.caption, color: colors.textMuted, marginTop: spacing.xl },
  legalDot: { ...font.caption, color: colors.textMuted },
  legalLink: { ...font.caption, color: colors.accent, fontWeight: '600' },
  legalLinks: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  notice: { ...font.caption, color: colors.danger, marginTop: spacing.lg },
  offerButton: { marginTop: spacing.md },
  offersLoading: { marginTop: spacing.lg },
  pendingTag: {
    ...font.caption,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  quotaBanner: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginTop: spacing.lg,
    padding: spacing.md,
  },
  quotaText: { ...font.caption, color: colors.text },
  restore: { marginTop: spacing.xl },
  restoreText: { ...font.label, color: colors.accent },
  title: { ...font.title, marginTop: spacing.xs },
  unavailable: { ...font.caption, color: colors.textMuted, marginTop: spacing.lg },
}))
