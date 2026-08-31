import { PLAN_LIMITS } from '@langx/shared'
import { router } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { LanguagePicker } from '../../src/components/LanguagePicker'
import { StepProgress } from '../../src/components/StepProgress'
import { authClient } from '../../src/lib/auth-client'
import { shouldGateGuest } from '../../src/lib/guestGate'
import { GUEST_ONBOARDING_STEPS } from '../../src/lib/onboardingStep'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { SegmentedControl } from '../../src/components/ui/SegmentedControl'
import { updateDraft, useOnboardingDraft } from '../../src/hooks/useOnboardingDraft'
import { makeStyles } from '../../src/lib/theme'
import { useT } from '../../src/i18n'

type LanguageTab = 'native' | 'learning'

/**
 * Step 1 of 5: both language questions, behind two tabs — v3's shape.
 *
 * The tabs are sequence, not choice: Continue on the native tab flips to the
 * learning tab rather than leaving the screen, so the second question is
 * always asked and always after the first (a language cannot be both, and the
 * disable-list each tab hands the picker depends on the other's answer).
 * Levels stay on their own step — they only exist because of this one.
 */
export default function LanguagesStep() {
  const styles = useStyles()
  const t = useT()

  const draft = useOnboardingDraft()
  const learningCodes = draft.learning.map((entry) => entry.code)

  // A resumed draft with native languages already picked reopens on the tab
  // that still has work in it.
  const [tab, setTab] = useState<LanguageTab>(() =>
    draft.nativeLanguages.length > 0 && draft.learning.length === 0 ? 'learning' : 'native',
  )

  function toggleNative(code: string): void {
    const next = draft.nativeLanguages.includes(code)
      ? draft.nativeLanguages.filter((existing) => existing !== code)
      : [...draft.nativeLanguages, code]
    updateDraft({ nativeLanguages: next })
  }

  function toggleLearning(code: string): void {
    // The level is asked for on the next screen, so a language arrives here
    // without one. `null` rather than a default: see `OnboardingDraft`.
    const next = learningCodes.includes(code)
      ? draft.learning.filter((entry) => entry.code !== code)
      : [...draft.learning, { code, level: null }]
    updateDraft({ learning: next })
  }

  const onNative = tab === 'native'

  const { data: session } = authClient.useSession()

  const isGuest = shouldGateGuest(session?.user)

  // The hint reports the cap of the tab you are on, and both come from the

  // free row because onboarding is always the free tier.

  const max = onNative ? PLAN_LIMITS.free.maxNativeLanguages : PLAN_LIMITS.free.maxLearningLanguages

  function onContinue(): void {
    if (onNative) setTab('learning')
    else router.push('/(onboarding)/levels')
  }

  return (
    <Screen fluid style={styles.screen}>
      <StepProgress step="languages" steps={isGuest ? GUEST_ONBOARDING_STEPS : undefined} />
      <Text style={styles.title}>{t('onboarding.languagesTitle')}</Text>
      <Text style={styles.subtitle}>{t('onboarding.languagesBody')}</Text>

      <View style={styles.tabs}>
        <SegmentedControl<LanguageTab>
          accessibilityLabel={t('onboarding.languagesTitle')}
          options={[
            { value: 'native', label: t('onboarding.native') },
            { value: 'learning', label: t('onboarding.learning') },
          ]}
          selected={[tab]}
          onToggle={setTab}
        />
      </View>

      {/*
        Keyed by tab so switching remounts the picker and drops its search
        query. Without the key React keeps the same instance — same type, same
        position — and the term typed to find a native language survives into
        the learning tab, where it hides everything the user came to pick.
      */}
      {onNative ? (
        <LanguagePicker
          key="native"
          selected={draft.nativeLanguages}
          onToggle={toggleNative}
          // A language cannot be both native and learning — the server rejects
          // it, so the picker should never let it be picked in the first place.
          disabledCodes={learningCodes}
          disabledLabel={t('onboarding.learning')}
          max={PLAN_LIMITS.free.maxNativeLanguages}
        />
      ) : (
        <LanguagePicker
          key="learning"
          selected={learningCodes}
          onToggle={toggleLearning}
          disabledCodes={draft.nativeLanguages}
          disabledLabel={t('onboarding.native')}
          max={PLAN_LIMITS.free.maxLearningLanguages}
        />
      )}

      <View style={styles.footer}>
        <Text style={styles.hint}>
          {t('onboarding.upToCount', { count: max })} · {t('onboarding.cannotBeBoth')}
        </Text>
        <Button
          label={t('common.continue')}
          disabled={onNative ? draft.nativeLanguages.length === 0 : draft.learning.length === 0}
          onPress={onContinue}
        />
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  screen: { paddingBottom: spacing.lg },
  title: { ...font.title, color: colors.text, lineHeight: 38, marginTop: spacing.xl + 2 },
  subtitle: {
    ...font.body,
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
    marginTop: spacing.sm + 2,
  },
  tabs: { marginBottom: spacing.sm, marginTop: spacing.xl },
  footer: { gap: spacing.md, paddingTop: spacing.lg },
  hint: { ...font.label, color: colors.textFaint, fontWeight: '400' },
}))
