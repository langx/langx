import Feather from '@expo/vector-icons/Feather'
import { router } from 'expo-router'
import * as Updates from 'expo-updates'
import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
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
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'

/**
 * Settings, as categories.
 *
 * One row per category with a line saying what is in it, each opening its own
 * page — the shape `me.tsx` has — instead of the one scroll that used to hold
 * thirty-four rows under nine kickers. Above them, a search over every row's
 * localized title and body: while there is a query, the categories give way
 * to the matching rows, each captioned with the category it lives in and
 * opening that page — so "incognito" lands on Privacy with the toggle in
 * view. Sign out stays at the foot, outside any category: it is the one thing
 * somebody comes here to do in a hurry.
 */
export default function SettingsScreen() {
  useScreenInteractive()
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

      <View style={styles.search}>
        <Feather name="search" size={18} color={colors.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('settings.search')}
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel={t('settings.search')}
          style={styles.searchInput}
        />
      </View>

      {searching ? (
        <View style={styles.list}>
          {matches.length === 0 ? (
            <Text style={styles.none}>{t('settings.searchNone')}</Text>
          ) : (
            matches.map(({ section, item }) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => router.push(section.route)}
                style={({ pressed }) => [styles.match, pressed && styles.pressed]}
              >
                <View style={styles.matchText}>
                  {/* Which category a found row lives in — the caption a search result needs. */}
                  <Text style={styles.matchSection}>{t(section.titleKey)}</Text>
                  <Text style={styles.matchTitle}>{t(item.titleKey)}</Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.textFaint} />
              </Pressable>
            ))
          )}
        </View>
      ) : (
        <View style={styles.list}>
          {SETTINGS_SECTIONS.map((section) => (
            <ListRow
              key={section.id}
              title={t(section.titleKey)}
              subtitle={t(section.bodyKey)}
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
        The things a support reply always has to ask for. v1 showed the version
        and the account id on its account page; v2 showed neither, so every "it
        is broken" message started with two extra round trips.

        The update id is the third, and the one that actually says which code
        is running: every merge to main ships over the air without touching the
        version, so two phones on 2.0 can be weeks apart. It is null where no
        update has been applied — the web, a dev build, the bundle the binary
        shipped with — and simply absent then.
      */}
      <Text style={styles.build} selectable>
        LangX {appVersion()}
        {Updates.updateId ? ` (${Updates.updateId.slice(0, 8)})` : ''} {t('settings.licence')}
        {model.profile ? `\n${model.profile._id}` : ''}
      </Text>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, spacing }) => ({
  /**
   * A 50px `fill` box with the glyph inside it, not a bare field: it is the
   * one thing on the page that is not a row, and the box is what says so.
   * 14 round — between the 12 and 16 of the scale, so a literal. The 2 on top
   * makes 12 with the header's own 10 below.
   */
  search: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    height: 50,
    marginTop: 2,
    paddingHorizontal: spacing.lg,
  },
  searchInput: { color: colors.text, flex: 1, fontSize: 16, height: '100%' },
  list: { marginTop: spacing.sm },
  // A point shorter than a category row: a result has a caption in place of
  // a body, and the caption is smaller.
  match: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    paddingVertical: spacing.lg,
  },
  pressed: { opacity: 0.6 },
  matchText: { flex: 1, gap: 2 },
  matchSection: { color: colors.textFaint, fontSize: 12, fontWeight: '600' },
  matchTitle: { color: colors.text, fontSize: 17, fontWeight: '600' },
  none: { color: colors.textFaint, fontSize: 14, paddingVertical: 40, textAlign: 'center' },
  signOut: { marginTop: 28 },
  build: {
    color: colors.textFaint,
    fontSize: 12,
    lineHeight: 19,
    paddingTop: spacing.xl,
    textAlign: 'center',
  },
}))
