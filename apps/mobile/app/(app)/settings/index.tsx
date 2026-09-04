import { router } from 'expo-router'
import { useState } from 'react'
import { Text, TextInput, View } from 'react-native'
import { SettingsRow } from '../../../src/components/settings/SettingsRow'
import { Button } from '../../../src/components/ui/Button'
import { ListRow } from '../../../src/components/ui/ListRow'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { appVersion } from '../../../src/hooks/useAppConfig'
import { useSettingsModel } from '../../../src/hooks/useSettingsModel'
import { useT } from '../../../src/i18n'
import { goBackTo } from '../../../src/lib/navigation'
import { matchSettings, SETTINGS_SECTIONS } from '../../../src/lib/settingsRegistry'
import { makeStyles, useTheme } from '../../../src/lib/theme'

/**
 * Settings, as categories.
 *
 * One row per category with a line saying what is in it, each opening its own
 * page — the shape `me.tsx` has — instead of the one scroll that used to hold
 * thirty-four rows under nine kickers. Above them, a search over every row's
 * localized title and body: while there is a query, the categories give way
 * to the matching rows themselves, drawn live, so "incognito" finds the
 * incognito toggle and it can be flipped right here. Sign out stays at the
 * foot, outside any category: it is the one thing somebody comes here to do
 * in a hurry.
 */
export default function SettingsScreen() {
  const styles = useStyles()
  const t = useT()
  const { colors } = useTheme()
  const model = useSettingsModel()
  const [query, setQuery] = useState('')

  const matches = matchSettings(SETTINGS_SECTIONS, query, t)
  const searching = query.trim().length >= 2

  return (
    <Screen scroll>
      <ScreenHeader title={t('settings.title')} onBack={() => goBackTo('/(app)/(tabs)/me')} />

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t('settings.search')}
        placeholderTextColor={colors.textFaint}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        accessibilityLabel={t('settings.search')}
        style={styles.search}
      />

      {searching ? (
        matches.length === 0 ? (
          <Text style={styles.none}>{t('settings.searchNone')}</Text>
        ) : (
          matches.map(({ section, item }, index) => (
            <View key={item.id} style={styles.match}>
              <Text style={styles.matchSection}>{t(section.titleKey)}</Text>
              <SettingsRow id={item.id} model={model} last={index === matches.length - 1} />
            </View>
          ))
        )
      ) : (
        <View style={styles.categories}>
          {SETTINGS_SECTIONS.map((section, index) => (
            <ListRow
              key={section.id}
              title={t(section.titleKey)}
              subtitle={t(section.bodyKey)}
              last={index === SETTINGS_SECTIONS.length - 1}
              onPress={() => router.push(section.route)}
            />
          ))}
        </View>
      )}

      <Button
        label={t('settings.signOut')}
        variant="secondary"
        onPress={() => void model.signOut()}
        style={styles.signOut}
      />

      {/*
        The two things a support reply always has to ask for. v1 showed both on
        its account page; v2 showed neither, so every "it is broken" message
        started with two extra round trips.
      */}
      <Text style={styles.build} selectable>
        LangX {appVersion()} {t('settings.licence')}
        {model.profile ? `\n${model.profile._id}` : ''}
      </Text>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  /** The city field's idiom from `filters.tsx`: a square field, results under it. */
  search: {
    ...font.body,
    backgroundColor: colors.fill,
    borderRadius: radius.md,
    color: colors.text,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  categories: { marginTop: spacing.md },
  match: { marginTop: spacing.md },
  /** Which category a found row lives in — the caption a search result needs. */
  matchSection: { ...font.label, color: colors.textFaint },
  none: { ...font.caption, color: colors.textFaint, marginTop: spacing.xl, textAlign: 'center' },
  signOut: { marginTop: spacing.xl },
  build: {
    ...font.caption,
    color: colors.textFaint,
    marginBottom: spacing.xxl,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
}))
