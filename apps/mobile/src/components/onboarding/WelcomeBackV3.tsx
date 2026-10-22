import Feather from '@expo/vector-icons/Feather'
import { TIER_NAMES, TOKEN_RULES, normalizePlanTier, type StoredPaidPlanTier } from '@langx/shared'
import type { ReactNode } from 'react'
import { ScrollView, Text, View } from 'react-native'
import { useLocale, useT } from '../../i18n'
import { DISPLAY_FONT, makeStyles, useTheme, type PartnerHue } from '../../lib/theme'
import { tokenSlot } from '../../lib/tokenAmount'
import { NotificationPriming } from '../NotificationPriming'
import { Button } from '../ui/Button'
import { Screen } from '../ui/Screen'
import { FlameGlyph } from '../ui/StreakFlame'
import { TokenText } from '../ui/TokenIcon'
import { useBlackFont } from './WizardV3'

/** The restore as the route reads it off `/profiles/me`. */
interface Restored {
  tokensCredited: number
  conversationsImported: number
  frozenStreak: number
  lifetimeGranted?: StoredPaidPlanTier | null | undefined
}

/**
 * The returning v1 member's one screen, in the redesign's look: what came
 * back as a stack of rows, each with its own hue. Which rows appear, and what
 * each may honestly say, is exactly `app/(onboarding)/welcome-back.tsx`'s —
 * the comments there say why the tokens lead with the bonus and why the
 * streak is called live — and so is everything the buttons do.
 */
export function WelcomeBackV3({
  handle,
  canClaim,
  onClaim,
  restored,
  busy,
  onStart,
}: {
  handle: string
  canClaim: boolean
  onClaim: () => void
  restored: Restored
  busy: boolean
  onStart: () => void
}) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const { isRtl, locale } = useLocale()
  const black = useBlackFont()
  const { tokensCredited, conversationsImported, frozenStreak, lifetimeGranted } = restored

  return (
    <Screen fluid ground={v3.colors.bg}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={[styles.title, !black && styles.fallback]}>
            {t('welcomeBack.title')}
          </Text>
          <Text style={styles.subtitle}>{t('welcomeBack.subtitle')}</Text>
        </View>

        <View style={styles.rows}>
          <Row
            hue="sky"
            mark={<Feather name="user" size={v3.icon.lg} color={v3.colors.ink} />}
            title={t('welcomeBack.handleTitle', { handle })}
            body={canClaim ? t('welcomeBack.handleBodyChoose') : t('welcomeBack.handleBody')}
          >
            {canClaim ? (
              <Button
                variant="ink"
                size="small"
                icon="edit-2"
                label={t('welcomeBack.handleChoose')}
                onPress={onClaim}
                style={styles.rowAction}
              />
            ) : null}
          </Row>

          {conversationsImported > 0 ? (
            <Row
              hue="lilac"
              mark={<Feather name="message-circle" size={v3.icon.lg} color={v3.colors.ink} />}
              title={t('welcomeBack.conversations', { count: conversationsImported })}
              body={t('welcomeBack.conversationsBody')}
            />
          ) : null}

          {tokensCredited > 0 ? (
            <Row
              hue="lime"
              mark={<Feather name="star" size={v3.icon.lg} color={v3.colors.ink} />}
              // "1,250 ✦": the balance as the wallet now draws it.
              title={tokenSlot(t, tokensCredited + TOKEN_RULES.welcomeBackBonus, locale)}
              titleLabel={t('welcomeBack.tokensCarried', {
                count: tokensCredited + TOKEN_RULES.welcomeBackBonus,
              })}
              body={t('welcomeBack.tokensCarriedBody', {
                carried: tokensCredited,
                bonus: TOKEN_RULES.welcomeBackBonus,
              })}
            />
          ) : (
            <Row
              hue="lime"
              mark={<Feather name="star" size={v3.icon.lg} color={v3.colors.ink} />}
              title={tokenSlot(t, TOKEN_RULES.welcomeBackBonus, locale)}
              titleLabel={t('welcomeBack.tokensBonus', { count: TOKEN_RULES.welcomeBackBonus })}
              body={t('welcomeBack.tokensBonusBody')}
            />
          )}

          {frozenStreak > 0 ? (
            <Row
              hue="tangerine"
              mark={<FlameGlyph size={v3.icon.lg} color={v3.colors.ink} />}
              title={t('welcomeBack.streak', { count: frozenStreak })}
              body={t('welcomeBack.streakBody')}
            />
          ) : null}

          {lifetimeGranted ? (
            <Row
              hue="mint"
              mark={<Feather name="award" size={v3.icon.lg} color={v3.colors.ink} />}
              title={t('welcomeBack.tierForLife', {
                plan: TIER_NAMES[normalizePlanTier(lifetimeGranted)],
              })}
              body={t('welcomeBack.proBody')}
            />
          ) : null}
        </View>

        <NotificationPriming look="v3" />

        <Button
          label={busy ? t('common.oneMoment') : t('welcomeBack.startExploring')}
          icon={isRtl ? 'arrow-left' : 'arrow-right'}
          iconPosition="end"
          onPress={onStart}
          loading={busy}
          style={styles.start}
        />
      </ScrollView>
    </Screen>
  )
}

function Row({
  hue,
  mark,
  title,
  titleLabel,
  body,
  children,
}: {
  hue: PartnerHue
  mark: ReactNode
  /** May carry the token mark (`tokenSlot`); `titleLabel` then says it in words. */
  title: string
  titleLabel?: string
  body: string
  children?: ReactNode
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  return (
    <View style={styles.row}>
      <View style={[styles.mark, { backgroundColor: v3.hues[hue] }]}>{mark}</View>
      <View style={styles.rowText}>
        <TokenText text={title} label={titleLabel ?? title} style={styles.rowTitle} />
        <Text style={styles.rowBody}>{body}</Text>
        {children}
      </View>
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    gap: v3.space[10],
    paddingBottom: v3.space[16],
    paddingTop: v3.space[10],
  },
  header: { gap: v3.space[4], paddingHorizontal: v3.space[4] },
  title: { ...v3.type.display, color: v3.colors.fg },
  fallback: { fontFamily: DISPLAY_FONT },
  subtitle: { ...v3.type.body, color: v3.colors.muted },
  // One block cut into rows by the ground showing through two-point gaps.
  rows: { borderRadius: v3.radius.badge, gap: v3.space[2], overflow: 'hidden' },
  row: {
    backgroundColor: v3.colors.surface,
    flexDirection: 'row',
    gap: v3.space[12],
    padding: v3.space[12],
  },
  mark: {
    alignItems: 'center',
    borderRadius: v3.radius.icon,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  rowText: { flex: 1, gap: v3.space[2] },
  rowTitle: { ...v3.type.headline, color: v3.colors.fg },
  rowBody: { ...v3.type.caption, color: v3.colors.muted },
  rowAction: { alignSelf: 'flex-start', marginTop: v3.space[6], width: 'auto' },
  start: { marginTop: 'auto' },
}))
