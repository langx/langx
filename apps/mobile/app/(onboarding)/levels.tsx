import { LANGUAGE_LEVELS, type LanguageLevel } from '@langx/shared'
import { router } from 'expo-router'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { StepProgress } from '../../src/components/StepProgress'
import { Button } from '../../src/components/ui/Button'
import { LevelBars } from '../../src/components/ui/LevelBars'
import { Screen } from '../../src/components/ui/Screen'
import { updateDraft, useOnboardingDraft } from '../../src/hooks/useOnboardingDraft'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { levelShortLabel, useDisplayNames, useT } from '../../src/i18n'

/**
 * Step 2 of 5: how far along you are in each learning language.
 *
 * The choices draw v3's ascending bars rather than the raw enum
 * (`absoluteBeginner`) the chips used to show — a scale is what people
 * actually compare against, and the name sits underneath in the reader's
 * language. Nothing is preselected: a level nobody chose is the one field
 * that quietly decides who finds them.
 */
export default function LevelsStep() {
  const styles = useStyles()
  const { colors } = useTheme()
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
        {draft.learning.map((entry, index) => (
          <View
            key={entry.code}
            style={[styles.row, index < draft.learning.length - 1 && styles.rowDivider]}
          >
            <Text style={styles.language}>{names.language(entry.code)}</Text>
            <View style={styles.levelRow}>
              {LANGUAGE_LEVELS.map((level) => {
                const on = entry.level === level
                return (
                  <Pressable
                    key={level}
                    accessibilityRole="button"
                    accessibilityLabel={`${names.language(entry.code)} — ${levelShortLabel(t, level)}`}
                    accessibilityState={{ selected: on }}
                    onPress={() => setLevel(entry.code, level)}
                    style={({ pressed }) => [
                      styles.levelPill,
                      on ? styles.levelOn : styles.levelOff,
                      pressed && styles.pressed,
                    ]}
                  >
                    <LevelBars
                      level={level}
                      color={on ? colors.bg : colors.textFaint}
                      restColor={on ? colors.onInkMuted : colors.border}
                    />
                  </Pressable>
                )
              })}
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
  title: { ...font.title, color: colors.text, lineHeight: 38, marginTop: spacing.xl + 2 },
  subtitle: {
    ...font.body,
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
    marginTop: spacing.sm + 2,
  },
  list: { flex: 1, marginTop: spacing.md },
  row: { paddingVertical: spacing.lg },
  rowDivider: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  language: { ...font.heading, color: colors.text, fontSize: 17 },
  levelRow: { flexDirection: 'row', gap: 7, marginTop: spacing.md },
  levelPill: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 10,
    paddingTop: 11,
  },
  levelOn: { backgroundColor: colors.ink },
  levelOff: { borderColor: colors.border, borderWidth: 1 },
  pressed: { opacity: 0.7 },
  hint: { ...font.label, color: colors.textMuted, fontWeight: '400', marginTop: spacing.sm },
  cta: { marginTop: spacing.md },
}))
