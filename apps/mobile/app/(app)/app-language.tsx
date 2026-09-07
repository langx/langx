import { LOCALE_NAMES, SUPPORTED_LOCALES } from '@langx/shared'
import { Pressable, Text, View } from 'react-native'
import { useLocalePreference, useT } from '../../src/i18n'
import { Radio } from '../../src/components/ui/Radio'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { goBackTo } from '../../src/lib/navigation'
import { makeStyles } from '../../src/lib/theme'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

/**
 * `auto` leads because it is what almost everyone wants and what nobody has to
 * think about — the override exists for the people this app is full of, who
 * read a language their phone is not set to.
 */
const LOCALE_OPTIONS = ['auto', ...SUPPORTED_LOCALES] as const

/**
 * The app language, on its own screen.
 *
 * Nine rows stacked inside Settings made the list read as nine settings rather
 * than one with nine values, and pushed everything after it below the fold.
 * A screen rather than a modal because that is what this app already does with
 * settings-adjacent lists (`blocked`, `starred`), and because it earns a real
 * URL on the web build.
 *
 * Still a device preference, not an account one — a shared tablet should not
 * change language when somebody else signs in. See `I18nProvider`.
 */
export default function AppLanguageScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const { preference, setPreference, deviceLocale } = useLocalePreference()

  return (
    <Screen scroll>
      <ScreenHeader title={t('settings.appLanguage')} onBack={() => goBackTo('/(app)/settings')} />
      <View>
        {LOCALE_OPTIONS.map((option) => {
          const selected = preference === option
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setPreference(option)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text style={styles.rowTitle}>
                {option === 'auto'
                  ? t('settings.languageAuto', { name: LOCALE_NAMES[deviceLocale] })
                  : LOCALE_NAMES[option]}
              </Text>
              <Radio selected={selected} />
            </Pressable>
          )
        })}
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, spacing }) => ({
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    justifyContent: 'space-between',
    paddingVertical: 18,
  },
  pressed: { opacity: 0.6 },
  rowTitle: { color: colors.text, flex: 1, fontSize: 17, fontWeight: '600' },
}))
