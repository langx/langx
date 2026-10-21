import Feather from '@expo/vector-icons/Feather'
import { LANGUAGES } from '@langx/shared'
import { useLocalSearchParams } from 'expo-router'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { LanguageChipV3 } from '../../components/languages/LanguageChipV3'
import { PINNED_CODES, useLanguageSearch } from '../../components/LanguagePicker'
import { SettingsHeaderV3 } from '../../components/settings/v3/SettingsKitV3'
import { SettingsLeadV3 } from '../../components/settings/v3/SettingsFormV3'
import { ICON_BUTTON_TARGET } from '../../components/ui/IconButton'
import { Screen } from '../../components/ui/Screen'
import { useLanguageEditor } from '../../hooks/useLanguageEditor'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useDisplayNames, useT } from '../../i18n'
import { goBackTo } from '../../lib/navigation'
import { makeStyles, useTheme } from '../../lib/theme'

/**
 * Picking one language in the redesign's look (`V-LanguagePick`), behind
 * `flags.v3Home`. Which edit a pick sends, and that only a sent edit leaves
 * the screen, are `languages/pick.tsx`'s. The search is `LanguagePicker`'s
 * own hook, so what a query finds and what stays pinned cannot differ between
 * the looks; the chips are the board's, and with no query the long tail
 * after the pinned languages gets a heading of its own.
 */
export function LanguagePickScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const { v3 } = useTheme()
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
  const disabledLabel = t(native ? 'onboarding.learning' : 'onboarding.native')

  function choose(code: string): void {
    const edit = native
      ? replacing
        ? ({ kind: 'replaceNative', from: replacing, to: code } as const)
        : ({ kind: 'addNative', code } as const)
      : replacing
        ? ({ kind: 'replaceLearning', from: replacing, to: code } as const)
        : ({ kind: 'addLearning', code } as const)
    // Only leave if something was sent; a refusal has said why on this screen.
    if (apply(edit)) goBackTo('/(app)/languages')
  }

  // No `max`, as today: whether there is room was decided before this opened.
  const { query, setQuery, results, toggle } = useLanguageSearch({
    selected: mine,
    onToggle: choose,
  })

  /*
   * With no query, the chosen and pinned languages first and the rest under a
   * heading, as the board draws it. With one, the matches are one list: a
   * heading over a filtered handful would promise "all" and show three.
   */
  const searching = query.trim() !== ''
  const head = (code: string): boolean =>
    searching || mine.includes(code) || PINNED_CODES.includes(code)
  const top = results.filter((item) => head(item.code))
  // The catalogue is in English order; the heading says A to Z in the reader's.
  const tail = results
    .filter((item) => !head(item.code))
    .sort((a, b) => names.language(a.code).localeCompare(names.language(b.code)))

  function chip(item: { code: string }) {
    return (
      <LanguageChipV3
        key={item.code}
        label={names.language(item.code)}
        selected={mine.includes(item.code)}
        takenBy={theirs.includes(item.code) ? disabledLabel : undefined}
        onPress={() => toggle(item.code)}
      />
    )
  }

  return (
    <Screen fluid ground={v3.colors.bg}>
      <SettingsHeaderV3
        title={
          replacing
            ? t('languages.replaceTitle', { language: names.language(replacing) })
            : t(native ? 'languages.pickNativeTitle' : 'languages.pickLearningTitle')
        }
        onBack={() => goBackTo('/(app)/languages')}
      />
      <View style={styles.top}>
        <SettingsLeadV3>
          {replacing
            ? t('languages.replaceBody')
            : native
              ? t('languages.nativeBody')
              : t('languages.startsAtNew')}
        </SettingsLeadV3>
        <View style={styles.search}>
          <Feather name="search" size={v3.icon.lg} color={v3.colors.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('pickers.searchLanguages', { count: LANGUAGES.length })}
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
      </View>
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.chips}>{top.map(chip)}</View>
        {tail.length > 0 ? (
          <>
            <Text accessibilityRole="header" style={styles.heading}>
              {t('languages.allLanguages')}
            </Text>
            <View style={styles.chips}>{tail.map(chip)}</View>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  top: { gap: v3.space[12], paddingBottom: v3.space[10] },
  search: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[10],
    minHeight: 52,
    paddingEnd: v3.space[4],
    paddingStart: v3.space[16],
  },
  // `paddingVertical: 0`: Android's own TextInput padding would push the
  // words off the glyph beside them.
  searchInput: { ...v3.type.body, color: v3.colors.fg, flex: 1, paddingVertical: 0 },
  clear: {
    alignItems: 'center',
    height: ICON_BUTTON_TARGET,
    justifyContent: 'center',
    width: ICON_BUTTON_TARGET,
  },
  list: { flex: 1 },
  content: { gap: v3.space[12], paddingBottom: v3.space[20], paddingTop: v3.space[4] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[8] },
  heading: {
    ...v3.type.buttonSmall,
    color: v3.colors.muted,
    marginTop: v3.space[6],
    paddingStart: v3.space[4],
  },
}))
