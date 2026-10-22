import { LANGUAGE_LEVELS, levelRank, type LanguageLevel } from '@langx/shared'
import { ScrollView, Text, View } from 'react-native'
import { levelLabel, useDisplayNames, useLocale, useT } from '../../i18n'
import type { OnboardingStep } from '../../lib/onboardingStep'
import { makeStyles, useTheme } from '../../lib/theme'
import { Button } from '../ui/Button'
import { LevelBars } from '../ui/LevelBars'
import { Screen } from '../ui/Screen'
import { ChoiceRowV3, WizardHeaderV3, WizardTitle, useWizardStyles } from './WizardV3'

/**
 * Step 2 in the redesign's look: per learning language, the four levels as
 * four rows rather than four pills in one, so each carries its name as well
 * as its number and bars. Nothing is preselected, as today.
 */
export function LevelsV3({
  steps,
  onBack,
  learning,
  onSetLevel,
  canContinue,
  submitting,
  continueLabel,
  onContinue,
}: {
  steps: readonly OnboardingStep[] | undefined
  onBack: () => void
  learning: readonly { code: string; level: LanguageLevel | null }[]
  onSetLevel: (code: string, level: LanguageLevel) => void
  canContinue: boolean
  submitting: boolean
  /** A guest's last step submits and is labelled for where it goes. */
  continueLabel: string
  onContinue: () => void
}) {
  const t = useT()
  const names = useDisplayNames()
  const styles = useStyles()
  const wizard = useWizardStyles()
  const { v3 } = useTheme()
  const { isRtl } = useLocale()

  return (
    <Screen fluid ground={v3.colors.bg}>
      <View style={[wizard.column, wizard.fixed]}>
        <WizardHeaderV3 step="levels" steps={steps} onBack={onBack} />
        <WizardTitle title={t('onboarding.levelsTitle')} body={t('onboarding.levelsBody')} />

        <ScrollView style={styles.list} contentContainerStyle={styles.languages}>
          {learning.map((entry) => {
            const language = names.language(entry.code)
            return (
              <View key={entry.code} style={styles.language}>
                <View style={styles.languageHead}>
                  <Text accessibilityRole="header" style={styles.languageName}>
                    {language}
                  </Text>
                  <Text style={entry.level ? styles.chosen : styles.unchosen}>
                    {entry.level ? levelLabel(t, entry.level) : t('onboarding.pickALevel')}
                  </Text>
                </View>
                <View accessibilityRole="radiogroup" style={styles.levels}>
                  {LANGUAGE_LEVELS.map((level) => {
                    const on = entry.level === level
                    const name = levelLabel(t, level)
                    return (
                      <ChoiceRowV3
                        key={level}
                        tall
                        label={name}
                        selected={on}
                        accessibilityLabel={`${language} — ${name}`}
                        onPress={() => onSetLevel(entry.code, level)}
                        leading={
                          <>
                            <View style={[styles.disc, on && styles.discOn]}>
                              <Text style={[styles.discText, on && styles.discTextOn]}>
                                {levelRank(level)}
                              </Text>
                            </View>
                            <LevelBars
                              level={level}
                              size={20}
                              color={v3.colors.fg}
                              restColor={v3.colors.levelRest}
                            />
                          </>
                        }
                      />
                    )
                  })}
                </View>
              </View>
            )
          })}
        </ScrollView>

        <View style={wizard.footer}>
          <Button
            label={continueLabel}
            icon={isRtl ? 'arrow-left' : 'arrow-right'}
            iconPosition="end"
            disabled={!canContinue || submitting}
            loading={submitting}
            onPress={onContinue}
          />
        </View>
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  list: { flex: 1 },
  languages: { gap: v3.space[24], paddingTop: v3.space[14] },
  language: { gap: v3.space[12] },
  languageHead: {
    alignItems: 'baseline',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: v3.space[12],
    justifyContent: 'space-between',
    paddingHorizontal: v3.space[4],
  },
  languageName: { ...v3.type.headline, color: v3.colors.fg },
  chosen: { ...v3.type.caption, color: v3.colors.echoText, fontWeight: '700' },
  unchosen: { ...v3.type.caption, color: v3.colors.muted, fontWeight: '700' },
  levels: { gap: v3.space[8] },
  disc: {
    alignItems: 'center',
    backgroundColor: v3.colors.bg,
    borderRadius: v3.radius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  discOn: { backgroundColor: v3.colors.fg },
  discText: { ...v3.type.headline, color: v3.colors.fg },
  discTextOn: { color: v3.colors.pillText },
}))
