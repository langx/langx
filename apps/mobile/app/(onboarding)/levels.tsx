import { LANGUAGE_LEVELS, levelRank, type LanguageLevel } from '@langx/shared'
import { router } from 'expo-router'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../../src/api/client'
import { keys } from '../../src/api/queries'
import { StepProgress } from '../../src/components/StepProgress'
import { showAlert } from '../../src/lib/alert'
import { authClient } from '../../src/lib/auth-client'
import { shouldGateGuest } from '../../src/lib/guestGate'
import { goBackTo } from '../../src/lib/navigation'
import { GUEST_ONBOARDING_STEPS } from '../../src/lib/onboardingStep'
import { Button } from '../../src/components/ui/Button'
import { LevelBars } from '../../src/components/ui/LevelBars'
import { Screen } from '../../src/components/ui/Screen'
import { updateDraft, useOnboardingDraft } from '../../src/hooks/useOnboardingDraft'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { levelLabel, useDisplayNames, useT } from '../../src/i18n'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

/**
 * Step 2 of 5: how far along you are in each learning language.
 *
 * The choices draw v3's ascending bars rather than the raw enum
 * (`absoluteBeginner`) the chips used to show — a scale is what people
 * actually compare against, and the name sits beside it in the reader's
 * language. Nothing is preselected: a level nobody chose is the one field
 * that quietly decides who finds them.
 */
export default function LevelsStep() {
  useScreenInteractive()
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const names = useDisplayNames()

  const draft = useOnboardingDraft()
  const complete = draft.learning.every((entry) => entry.level !== null)
  const { data: session } = authClient.useSession()
  const isGuest = shouldGateGuest(session?.user)
  const queryClient = useQueryClient()
  const [submitting, setSubmitting] = useState(false)

  /**
   * For a guest this is the last step, so it submits; for everybody else it is
   * the middle of the wizard and it just advances.
   *
   * It deliberately does **not** call `resetDraft()`. The draft surviving this
   * submit is the entire mechanism behind "you are not asked for your languages
   * again" — after they register, `furthestOnboardingStep` reads it and returns
   * `about-you`. `resetDraft` is called from exactly one place, `handle.tsx` on
   * a real submit, and that has to stay true.
   */
  async function onContinue(): Promise<void> {
    if (!isGuest) {
      router.push('/(onboarding)/about-you')
      return
    }
    setSubmitting(true)
    try {
      await api.post('/profiles/guest', {
        nativeLanguages: draft.nativeLanguages.map((code) => ({ code })),
        learning: draft.learning.map((entry, index) => ({
          code: entry.code,
          level: entry.level,
          priority: index + 1,
        })),
      })
      await queryClient.invalidateQueries({ queryKey: keys.me })
      router.replace('/(app)/(tabs)/discover')
    } catch {
      setSubmitting(false)
      await showAlert(t('welcome.guestFailed'), t('common.retry'))
    }
  }

  function setLevel(code: string, level: LanguageLevel): void {
    updateDraft({
      learning: draft.learning.map((entry) => (entry.code === code ? { ...entry, level } : entry)),
    })
  }

  return (
    <Screen fluid style={styles.screen}>
      <StepProgress
        step="levels"
        steps={isGuest ? GUEST_ONBOARDING_STEPS : undefined}
        onBack={() => goBackTo('/(onboarding)/languages')}
      />
      <Text style={styles.title}>{t('onboarding.levelsTitle')}</Text>
      <Text style={styles.subtitle}>{t('onboarding.levelsBody')}</Text>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.rows}
        keyboardShouldPersistTaps="handled"
      >
        {draft.learning.map((entry) => (
          <View key={entry.code} style={styles.row}>
            <View style={styles.rowHead}>
              <Text style={styles.language}>{names.language(entry.code)}</Text>
              <Text style={styles.chosen}>
                {entry.level ? levelLabel(t, entry.level) : t('onboarding.pickALevel')}
              </Text>
            </View>
            <View style={styles.levelRow}>
              {LANGUAGE_LEVELS.map((level) => {
                const on = entry.level === level
                return (
                  <Pressable
                    key={level}
                    accessibilityRole="button"
                    accessibilityLabel={`${names.language(entry.code)} — ${levelLabel(t, level)}`}
                    accessibilityState={{ selected: on }}
                    onPress={() => setLevel(entry.code, level)}
                    style={({ pressed }) => [
                      styles.levelPill,
                      on ? styles.levelOn : styles.levelOff,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.levelNumber, on && styles.levelNumberOn]}>
                      {levelRank(level)}
                    </Text>
                    {/* On the ink fill the bars swap to the ground colour; off it they keep the defaults. */}
                    <LevelBars
                      level={level}
                      {...(on ? { color: colors.bg, restColor: colors.onInkMuted } : {})}
                    />
                  </Pressable>
                )
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      <Button
        label={isGuest ? t('welcome.browse') : t('common.continue')}
        disabled={!complete || submitting}
        loading={submitting}
        onPress={() => void onContinue()}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  // v3's wizard column: 8 above the progress block, 18 between blocks, 28
  // under the button so it is not sitting on the home indicator.
  screen: { gap: 18, paddingBottom: 28, paddingTop: spacing.sm },
  title: { ...font.title, color: colors.text, lineHeight: 38, marginTop: 10 },
  subtitle: { color: colors.textMuted, fontSize: 16, lineHeight: 24 },
  list: { flex: 1, marginTop: 10 },
  rows: { gap: 28 },
  row: { gap: spacing.md },
  rowHead: { alignItems: 'baseline', flexDirection: 'row', justifyContent: 'space-between' },
  language: { ...font.heading, color: colors.text },
  chosen: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  levelRow: { flexDirection: 'row', gap: spacing.sm },
  levelPill: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    height: 52,
    justifyContent: 'center',
  },
  levelOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  levelOff: { backgroundColor: colors.bg, borderColor: colors.border },
  levelNumber: { ...font.heading, color: colors.text, fontSize: 16 },
  levelNumberOn: { color: colors.bg },
  pressed: { opacity: 0.7 },
}))
