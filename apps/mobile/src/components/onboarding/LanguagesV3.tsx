import Feather from '@expo/vector-icons/Feather'
import { LANGUAGES } from '@langx/shared'
import { useLayoutEffect, useRef } from 'react'
import { Animated, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useReduceMotion } from '../../hooks/useReduceMotion'
import { useDisplayNames, useLocale, useT } from '../../i18n'
import type { OnboardingStep } from '../../lib/onboardingStep'
import { makeStyles, useTheme } from '../../lib/theme'
import { EASE_OUT } from '../../lib/theme/motionAnimated'
import { DURATION } from '../../lib/theme/motionValues'
import { useLanguageSearch } from '../LanguagePicker'
import { Button } from '../ui/Button'
import { ICON_BUTTON_TARGET } from '../ui/IconButton'
import { Screen } from '../ui/Screen'
import { SegmentedControl } from '../ui/SegmentedControl'
import { ChoiceRowV3, WizardHeaderV3, WizardTitle, useWizardStyles } from './WizardV3'

type LanguageTab = 'native' | 'learning'

/**
 * Step 1 in the redesign's look: both language questions behind two tabs, as
 * today, with each language a row of its own — its name in the reader's
 * language, beside the name it has for itself — and a ring that fills when
 * it is picked. The route keeps every rule: the tabs are a sequence, and a
 * language cannot be both.
 */
export function LanguagesV3({
  steps,
  tab,
  onTab,
  nativeLanguages,
  learning,
  onToggleNative,
  onToggleLearning,
  max,
  canContinue,
  onContinue,
}: {
  steps: readonly OnboardingStep[] | undefined
  tab: LanguageTab
  onTab: (tab: LanguageTab) => void
  nativeLanguages: string[]
  learning: string[]
  onToggleNative: (code: string) => void
  onToggleLearning: (code: string) => void
  max: number
  canContinue: boolean
  onContinue: () => void
}) {
  const t = useT()
  const { v3 } = useTheme()
  const { isRtl } = useLocale()
  const wizard = useWizardStyles()
  const styles = useStyles()
  const onNative = tab === 'native'

  /*
   * The other tab's list dissolves in rather than replacing this one in a
   * frame. Only the list that arrives fades: the two are different lists, and
   * keyed apart (below), so there is no old one left to fade out. Set before
   * the frame is drawn, or the new list would flash in full first.
   */
  const reduceMotion = useReduceMotion()
  const fade = useRef(new Animated.Value(1)).current
  const shownTab = useRef(tab)
  useLayoutEffect(() => {
    if (shownTab.current === tab) return
    shownTab.current = tab
    if (reduceMotion) return
    fade.setValue(0)
    // Not stopped on cleanup: a stop part-way would leave the list faint. A
    // tab tapped again mid-fade starts a new timing, which replaces this one.
    Animated.timing(fade, {
      toValue: 1,
      duration: DURATION.crossfade,
      easing: EASE_OUT,
      useNativeDriver: true,
    }).start()
  }, [tab, reduceMotion, fade])

  return (
    <Screen fluid ground={v3.colors.bg}>
      <View style={[wizard.column, wizard.fixed]}>
        <WizardHeaderV3 step="languages" steps={steps} />
        <WizardTitle title={t('onboarding.languagesTitle')} body={t('onboarding.languagesBody')} />

        <SegmentedControl<LanguageTab>
          accessibilityLabel={t('onboarding.languagesTitle')}
          options={[
            { value: 'native', label: t('onboarding.native') },
            { value: 'learning', label: t('onboarding.learning') },
          ]}
          selected={[tab]}
          onToggle={onTab}
        />

        {/*
          Keyed by tab, for the reason the route gives: a search typed on one
          tab must not survive into the other.
        */}
        <Animated.View style={[styles.picker, { opacity: fade }]}>
          {onNative ? (
            <LanguagePickerV3
              key="native"
              selected={nativeLanguages}
              onToggle={onToggleNative}
              disabledCodes={learning}
              disabledLabel={t('onboarding.learning')}
              max={max}
            />
          ) : (
            <LanguagePickerV3
              key="learning"
              selected={learning}
              onToggle={onToggleLearning}
              disabledCodes={nativeLanguages}
              disabledLabel={t('onboarding.native')}
              max={max}
              multiple
            />
          )}
        </Animated.View>

        <View style={wizard.footer}>
          <Text style={wizard.hint}>
            {t('onboarding.upToCount', { count: max })} · {t('onboarding.cannotBeBoth')}
          </Text>
          <Button
            label={t('common.continue')}
            icon={isRtl ? 'arrow-left' : 'arrow-right'}
            iconPosition="end"
            disabled={!canContinue}
            onPress={onContinue}
          />
        </View>
      </View>
    </Screen>
  )
}

/**
 * The picker's rows. The search is `LanguagePicker`'s own hook, so what a
 * query finds, what is pinned and when the query clears are the same in both
 * looks.
 */
function LanguagePickerV3({
  selected,
  onToggle,
  disabledCodes,
  disabledLabel,
  max,
  multiple = false,
}: {
  selected: string[]
  onToggle: (code: string) => void
  disabledCodes: string[]
  disabledLabel: string
  max: number
  multiple?: boolean
}) {
  const t = useT()
  const names = useDisplayNames()
  const styles = useStyles()
  const { v3 } = useTheme()
  const { query, setQuery, results, atLimit, toggle } = useLanguageSearch({
    selected,
    onToggle,
    max,
  })
  const placeholder = t('pickers.searchLanguages', { count: LANGUAGES.length })

  return (
    <View style={styles.root}>
      <View style={styles.search}>
        <Feather name="search" size={v3.icon.lg} color={v3.colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder}
          accessibilityLabel={placeholder}
          placeholderTextColor={v3.colors.muted}
          style={styles.searchInput}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query ? (
          <Pressable
            accessibilityLabel={t('common.clear')}
            accessibilityRole="button"
            onPress={() => setQuery('')}
            style={styles.clear}
          >
            <Feather name="x" size={v3.icon.md} color={v3.colors.muted} />
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.rows}
        keyboardShouldPersistTaps="handled"
      >
        {results.map((item) => {
          const isSelected = selected.includes(item.code)
          const isTaken = disabledCodes.includes(item.code)
          const label = names.language(item.code)
          // The name the language has for itself, when it is not the one
          // already shown: "Spanish · Español", but "English" alone.
          const detail = item.nativeName !== label ? item.nativeName : undefined
          return (
            <ChoiceRowV3
              key={item.code}
              label={label}
              detail={detail}
              selected={isSelected}
              disabled={isTaken || (atLimit && !isSelected)}
              tag={isTaken ? disabledLabel : undefined}
              role={multiple ? 'checkbox' : 'radio'}
              onPress={() => toggle(item.code)}
            />
          )
        })}
      </ScrollView>
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  picker: { flex: 1, minHeight: 0 },
  root: { flex: 1, gap: v3.space[12], minHeight: 0 },
  search: {
    alignItems: 'center',
    borderColor: v3.colors.line,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    flexDirection: 'row',
    gap: v3.space[10],
    minHeight: 56,
    paddingHorizontal: v3.space[16],
  },
  // `paddingVertical: 0`: Android's own TextInput padding would push the
  // words off the glyph beside them.
  searchInput: { ...v3.type.body, color: v3.colors.fg, flex: 1, paddingVertical: 0 },
  // The platform's minimum target around a 20pt glyph.
  clear: {
    alignItems: 'center',
    height: ICON_BUTTON_TARGET,
    justifyContent: 'center',
    width: ICON_BUTTON_TARGET,
  },
  list: { flex: 1 },
  rows: { gap: v3.space[8], paddingBottom: v3.space[8] },
}))
