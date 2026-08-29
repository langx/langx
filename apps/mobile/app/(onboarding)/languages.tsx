import { LEVEL_SHORT_LABELS, LANGUAGE_LEVELS, getLanguage, type LanguageLevel } from '@langx/shared'
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { LanguagePicker } from '../../src/components/LanguagePicker'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { updateDraft, useOnboardingDraft } from '../../src/hooks/useOnboardingDraft'
import { makeStyles } from '../../src/lib/theme'

/**
 * Step 1 of 3. Languages come first because they are the only answers the
 * product cannot work without — discovery is built entirely on the mutual fit
 * between what you speak and what you want to learn.
 */
export default function LanguagesStep() {
  const styles = useStyles()

  const draft = useOnboardingDraft()
  const [mode, setMode] = useState<'native' | 'learning'>('native')

  const learningCodes = draft.learning.map((l) => l.code)
  const canContinue = draft.nativeLanguages.length > 0 && draft.learning.length > 0

  function toggleNative(code: string): void {
    const next = draft.nativeLanguages.includes(code)
      ? draft.nativeLanguages.filter((c) => c !== code)
      : [...draft.nativeLanguages, code]
    updateDraft({ nativeLanguages: next })
  }

  function toggleLearning(code: string): void {
    const next = learningCodes.includes(code)
      ? draft.learning.filter((l) => l.code !== code)
      : [...draft.learning, { code, level: 'absoluteBeginner' as LanguageLevel }]
    updateDraft({ learning: next })
  }

  function setLevel(code: string, level: LanguageLevel): void {
    updateDraft({ learning: draft.learning.map((l) => (l.code === code ? { ...l, level } : l)) })
  }

  return (
    <Screen fluid style={styles.screen}>
      {/*
        Four bars rather than "1 / 4" alone. The count says where you are; the
        bars say how much is left, which is the question someone halfway
        through an onboarding is actually asking.
      */}
      <View style={styles.progress}>
        {[0, 1, 2, 3].map((index) => (
          <View key={index} style={[styles.progressBar, index === 0 && styles.progressBarOn]} />
        ))}
        <Text style={styles.step}>1/4</Text>
      </View>
      <Text style={styles.title}>Which languages do you speak?</Text>
      <Text style={styles.subtitle}>
        Your native language is what you can teach; what you're learning is who you'll match with.
      </Text>

      <View style={styles.tabs}>
        <Pressable
          onPress={() => setMode('native')}
          style={[styles.tab, mode === 'native' && styles.tabActive]}
        >
          <Text style={[styles.tabLabel, mode === 'native' && styles.tabLabelActive]}>
            Native · {draft.nativeLanguages.length}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('learning')}
          style={[styles.tab, mode === 'learning' && styles.tabActive]}
        >
          <Text style={[styles.tabLabel, mode === 'learning' && styles.tabLabelActive]}>
            Learning · {draft.learning.length}
          </Text>
        </Pressable>
      </View>

      {mode === 'native' ? (
        <LanguagePicker
          selected={draft.nativeLanguages}
          onToggle={toggleNative}
          // A language cannot be both native and learning — the server rejects
          // it, so the picker should never let it be picked in the first place.
          disabledCodes={learningCodes}
          max={5}
        />
      ) : (
        <View style={styles.learningPane}>
          <LanguagePicker
            selected={learningCodes}
            onToggle={toggleLearning}
            disabledCodes={draft.nativeLanguages}
            max={5}
          />
          {draft.learning.length > 0 ? (
            <ScrollView style={styles.levels} keyboardShouldPersistTaps="handled">
              <Text style={styles.levelsTitle}>Your level</Text>
              {draft.learning.map((entry) => (
                <View key={entry.code} style={styles.levelRow}>
                  <Text style={styles.levelLang}>
                    {getLanguage(entry.code)?.name ?? entry.code}
                  </Text>
                  <View style={styles.levelChips}>
                    {LANGUAGE_LEVELS.map((level) => (
                      <Pressable
                        key={level}
                        onPress={() => setLevel(entry.code, level)}
                        style={[styles.levelChip, entry.level === level && styles.levelChipActive]}
                      >
                        <Text
                          style={[
                            styles.levelChipText,
                            entry.level === level && styles.levelChipTextActive,
                          ]}
                        >
                          {level}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.levelHint}>{LEVEL_SHORT_LABELS[entry.level]}</Text>
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>
      )}

      <View style={styles.hints}>
        <Text style={styles.hint}>Up to 5</Text>
        <Text style={styles.hint}>A language can&apos;t be both</Text>
      </View>

      <Button
        label="Continue"
        disabled={!canContinue}
        onPress={() => router.push('/(onboarding)/about-you')}
        style={styles.cta}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  screen: { paddingBottom: spacing.lg },
  progress: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  progressBar: {
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    flex: 1,
    height: 6,
  },
  progressBarOn: { backgroundColor: colors.primary },
  step: { ...font.caption, color: colors.textMuted, fontWeight: '600' },
  title: { ...font.title, color: colors.text, fontSize: 27, marginTop: spacing.xl },
  subtitle: {
    ...font.body,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
  },
  tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  tab: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabLabel: { ...font.label, color: colors.textMuted },
  tabLabelActive: { color: colors.primaryText },
  learningPane: { flex: 1 },
  levels: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    maxHeight: 220,
    paddingTop: spacing.md,
  },
  levelsTitle: { ...font.label, color: colors.textMuted, marginBottom: spacing.sm },
  levelRow: { marginBottom: spacing.md },
  levelLang: { ...font.body, color: colors.text, fontWeight: '600', marginBottom: spacing.xs },
  levelChips: { flexDirection: 'row', gap: spacing.xs },
  levelChip: {
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  levelChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  levelChipText: { ...font.caption, color: colors.textMuted },
  // `textInverse`, not `primaryText`: the active chip is filled with `accent`,
  // which is not `primary` and does not take black on it in light mode.
  levelChipTextActive: { color: colors.textInverse, fontWeight: '700' },
  levelHint: { ...font.caption, color: colors.textMuted, marginTop: spacing.xs },
  hints: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
    paddingTop: spacing.lg,
  },
  hint: { ...font.caption, color: colors.textMuted },
  cta: { marginTop: 0 },
}))
