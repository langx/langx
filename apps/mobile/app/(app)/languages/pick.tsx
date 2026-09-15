import { useLocalSearchParams } from 'expo-router'
import { Text } from 'react-native'
import { LanguagePicker } from '../../../src/components/LanguagePicker'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { useLanguageEditor } from '../../../src/hooks/useLanguageEditor'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { useDisplayNames, useT } from '../../../src/i18n'
import { goBackTo } from '../../../src/lib/navigation'
import { makeStyles } from '../../../src/lib/theme'

/**
 * Pick one language: the language this row becomes, or the one being added.
 *
 * A pushed screen rather than a pane on the list, and the pop is what confirms
 * it — one visit is one language is one request. The alternative was a mode
 * variable on the list saying which row was being edited, which is the state
 * machine this screen exists to delete. It also gives a hundred and eighty
 * languages the full height they need with a keyboard up, which the 320pt pane
 * never had.
 *
 * No `max`: whether there is room was decided before this screen opened, and
 * a replacement does not change the count at all. The chips that are dimmed
 * here are the ones on the *other* list, with the reason written after the
 * name — which the old screen never passed, so a language that could not be
 * picked simply looked broken.
 */
export default function PickLanguageScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const names = useDisplayNames()
  const { list, replacing } = useLocalSearchParams<{ list?: string; replacing?: string }>()
  const { profile, apply } = useLanguageEditor()

  const native = list !== 'learning'
  const mine = profile
    ? native
      ? profile.nativeLanguages.map((l) => l.code)
      : profile.learning.map((l) => l.code)
    : []
  const theirs = profile
    ? native
      ? profile.learning.map((l) => l.code)
      : profile.nativeLanguages.map((l) => l.code)
    : []

  function choose(code: string): void {
    const edit = native
      ? replacing
        ? ({ kind: 'replaceNative', from: replacing, to: code } as const)
        : ({ kind: 'addNative', code } as const)
      : replacing
        ? ({ kind: 'replaceLearning', from: replacing, to: code } as const)
        : ({ kind: 'addLearning', code } as const)
    // Only leave if something was sent. A refusal has said why on this screen,
    // where the language it is about is still on the list.
    if (apply(edit)) goBackTo('/(app)/languages')
  }

  return (
    <Screen fluid style={styles.screen}>
      <ScreenHeader
        title={
          replacing
            ? t('languages.replaceTitle', { language: names.language(replacing) })
            : t(native ? 'languages.pickNativeTitle' : 'languages.pickLearningTitle')
        }
        onBack={() => goBackTo('/(app)/languages')}
      />
      <Text style={styles.body}>
        {replacing
          ? t('languages.replaceBody')
          : native
            ? t('languages.nativeBody')
            : t('languages.startsAtNew')}
      </Text>
      <LanguagePicker
        selected={mine}
        onToggle={choose}
        disabledCodes={theirs}
        disabledLabel={t(native ? 'onboarding.learning' : 'onboarding.native')}
      />
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, spacing }) => ({
  screen: { gap: spacing.md, paddingBottom: 28 },
  body: { color: colors.textMuted, fontSize: 15, lineHeight: 22 },
}))
