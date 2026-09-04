import Feather from '@expo/vector-icons/Feather'
import { LOCALE_NAMES, SUPPORTED_LOCALES } from '@langx/shared'
import { View } from 'react-native'
import { useLocalePreference, useT } from '../../src/i18n'
import { ListRow } from '../../src/components/ui/ListRow'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { goBackTo } from '../../src/lib/navigation'
import { useTheme } from '../../src/lib/theme'
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
  const t = useT()
  const { colors } = useTheme()
  const { preference, setPreference, deviceLocale } = useLocalePreference()

  return (
    <Screen scroll>
      <ScreenHeader
        title={t('settings.languageSection')}
        onBack={() => goBackTo('/(app)/settings')}
      />
      <View>
        {LOCALE_OPTIONS.map((option, index) => (
          <ListRow
            key={option}
            title={
              option === 'auto'
                ? t('settings.languageAuto', { name: LOCALE_NAMES[deviceLocale] })
                : LOCALE_NAMES[option]
            }
            last={index === LOCALE_OPTIONS.length - 1}
            onPress={() => setPreference(option)}
            accessory={
              preference === option ? (
                <Feather name="check" size={18} color={colors.accent} />
              ) : undefined
            }
          />
        ))}
      </View>
    </Screen>
  )
}
