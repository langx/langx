import { CEFR_LABELS, CEFR_LEVELS, getLanguage, type CefrLevel } from '@langx/shared'
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { LanguagePicker } from '../../src/components/LanguagePicker'
import { Button } from '../../src/components/ui/Button'
import { Screen } from '../../src/components/ui/Screen'
import { updateDraft, useOnboardingDraft } from '../../src/hooks/useOnboardingDraft'
import { colors, font, radius, spacing } from '../../src/lib/theme'

/**
 * Step 1 of 3. Languages come first because they are the only answers the
 * product cannot work without — discovery is built entirely on the mutual fit
 * between what you speak and what you want to learn.
 */
export default function LanguagesStep() {
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
      : [...draft.learning, { code, level: 'A1' as CefrLevel }]
    updateDraft({ learning: next })
  }

  function setLevel(code: string, level: CefrLevel): void {
    updateDraft({ learning: draft.learning.map((l) => (l.code === code ? { ...l, level } : l)) })
  }

  return (
    <Screen fluid style={styles.screen}>
      <Text style={styles.step}>1 / 3</Text>
      <Text style={styles.title}>Hangi dilleri konuşuyorsun?</Text>
      <Text style={styles.subtitle}>
        Ana dilin öğretebileceğin, öğrendiğin dil ise eşleşeceğin kişiyi belirler.
      </Text>

      <View style={styles.tabs}>
        <Pressable
          onPress={() => setMode('native')}
          style={[styles.tab, mode === 'native' && styles.tabActive]}
        >
          <Text style={[styles.tabLabel, mode === 'native' && styles.tabLabelActive]}>
            Ana dilim ({draft.nativeLanguages.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('learning')}
          style={[styles.tab, mode === 'learning' && styles.tabActive]}
        >
          <Text style={[styles.tabLabel, mode === 'learning' && styles.tabLabelActive]}>
            Öğreniyorum ({draft.learning.length})
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
              <Text style={styles.levelsTitle}>Seviyen</Text>
              {draft.learning.map((entry) => (
                <View key={entry.code} style={styles.levelRow}>
                  <Text style={styles.levelLang}>
                    {getLanguage(entry.code)?.name ?? entry.code}
                  </Text>
                  <View style={styles.levelChips}>
                    {CEFR_LEVELS.map((level) => (
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
                  <Text style={styles.levelHint}>{CEFR_LABELS[entry.level]}</Text>
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>
      )}

      <Button
        label="Devam"
        disabled={!canContinue}
        onPress={() => router.push('/(onboarding)/about-you')}
        style={styles.cta}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  screen: { paddingBottom: spacing.lg },
  step: { ...font.caption, color: colors.textMuted, marginTop: spacing.lg },
  title: { ...font.title, color: colors.text, marginTop: spacing.xs },
  subtitle: {
    ...font.body,
    color: colors.textMuted,
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
  },
  tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  tab: {
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
  levelChipTextActive: { color: colors.primaryText, fontWeight: '700' },
  levelHint: { ...font.caption, color: colors.textMuted, marginTop: spacing.xs },
  cta: { marginTop: spacing.md },
})
