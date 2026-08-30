import { LANGUAGE_LEVELS, levelRank, type LanguageLevel } from '@langx/shared'
import { router } from 'expo-router'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { StepProgress } from '../../src/components/StepProgress'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { updateDraft, useOnboardingDraft } from '../../src/hooks/useOnboardingDraft'
import { makeStyles } from '../../src/lib/theme'
import { levelShortLabel, useDisplayNames, useT } from '../../src/i18n'

/**
 * Step 3 of 6: how far along you are in each of them.
 *
 * Numbered 1 to 4 rather than named, because the chips used to show the raw
 * enum (`absoluteBeginner`) and a scale is what people actually compare
 * against — the name is underneath, in the reader's language. Nothing is
 * preselected: a level nobody chose is the one field that quietly decides who
 * finds them.
 */
export default function LevelsStep() {
  const styles = useStyles()
  const t = useT()
  const names = useDisplayNames()

  const draft = useOnboardingDraft()
  const complete = draft.learning.every((entry) => entry.level !== null)

  function setLevel(code: string, level: LanguageLevel): void {
    updateDraft({
      learning: draft.learning.map((entry) => (entry.code === code ? { ...entry, level } : entry)),
    })
  }

  return (
    <Screen fluid style={styles.screen}>
      <StepProgress step="levels" />
      <Text style={styles.title}>{t('onboarding.levelsTitle')}</Text>
      <Text style={styles.subtitle}>{t('onboarding.levelsBody')}</Text>

      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        {draft.learning.map((entry) => (
          <View key={entry.code} style={styles.row}>
            <Text style={styles.language}>{names.language(entry.code)}</Text>
            <View style={styles.chips}>
              {LANGUAGE_LEVELS.map((level) => (
                <Pressable
                  key={level}
                  accessibilityRole="button"
                  accessibilityLabel={`${names.language(entry.code)} — ${levelShortLabel(t, level)}`}
                  accessibilityState={{ selected: entry.level === level }}
                  onPress={() => setLevel(entry.code, level)}
                  style={[styles.chip, entry.level === level && styles.chipActive]}
                >
                  <Text style={[styles.chipText, entry.level === level && styles.chipTextActive]}>
                    {levelRank(level)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.hint}>
              {entry.level ? levelShortLabel(t, entry.level) : t('onboarding.pickALevel')}
            </Text>
          </View>
        ))}
      </ScrollView>

      <Button
        label={t('common.continue')}
        disabled={!complete}
        onPress={() => router.push('/(onboarding)/about-you')}
        style={styles.cta}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  screen: { paddingBottom: spacing.lg },
  title: { ...font.title, color: colors.text, fontSize: 27, marginTop: spacing.xl },
  subtitle: {
    ...font.body,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
  },
  list: { flex: 1 },
  row: { marginBottom: spacing.lg },
  language: { ...font.body, color: colors.text, fontWeight: '600', marginBottom: spacing.sm },
  chips: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingVertical: spacing.sm,
    width: 56,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { ...font.body, color: colors.textMuted, fontWeight: '700' },
  // `textInverse`, not `primaryText`: the active chip is filled with `accent`,
  // which is not `primary` and does not take black on it in light mode.
  chipTextActive: { color: colors.textInverse },
  hint: { ...font.caption, color: colors.textMuted, marginTop: spacing.xs },
  cta: { marginTop: spacing.md },
}))
