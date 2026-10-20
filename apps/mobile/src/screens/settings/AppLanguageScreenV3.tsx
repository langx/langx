import Feather from '@expo/vector-icons/Feather'
import { LOCALE_NAMES, SUPPORTED_LOCALES } from '@langx/shared'
import { Pressable, Text, View } from 'react-native'
import { SettingsGroupV3, SettingsScreenV3 } from '../../components/settings/v3/SettingsKitV3'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useLocalePreference, useT } from '../../i18n'
import { makeStyles, useTheme } from '../../lib/theme'
import { partnerHueFor } from '../../lib/theme/partnerHue'

/** `auto` leads, as in `app-language.tsx`: what almost everyone wants. */
const LOCALE_OPTIONS = ['auto', ...SUPPORTED_LOCALES] as const

/**
 * The app language in the redesign's look (`V-AppLanguage`), behind
 * `flags.v3Home`: one grey block of radio rows. Still a device preference,
 * set through the same `setPreference`, with the same nine options and
 * names as `app-language.tsx`.
 */
export function AppLanguageScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const { preference, setPreference, deviceLocale } = useLocalePreference()

  return (
    <SettingsScreenV3 title={t('settings.appLanguage')} back="/(app)/settings">
      <SettingsGroupV3>
        {LOCALE_OPTIONS.map((option) => {
          const selected = preference === option
          const name =
            option === 'auto'
              ? t('settings.languageAuto', { name: LOCALE_NAMES[deviceLocale] })
              : LOCALE_NAMES[option]
          return (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              // The name alone, as today: the code on the square is decoration.
              accessibilityLabel={name}
              onPress={() => setPreference(option)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View
                style={[
                  styles.square,
                  {
                    backgroundColor:
                      option === 'auto' ? v3.colors.line : v3.hues[partnerHueFor(option)],
                  },
                ]}
              >
                {option === 'auto' ? (
                  <Feather name="smartphone" size={v3.icon.lg} color={v3.colors.fg} />
                ) : (
                  // The locale's own code: not a word, so not translated.
                  <Text style={styles.code}>{option.slice(0, 2).toUpperCase()}</Text>
                )}
              </View>
              <Text style={styles.title}>{name}</Text>
              <View style={[styles.ring, selected && styles.ringOn]}>
                {selected ? (
                  <Feather name="check" size={v3.icon.xs} color={v3.colors.onBlue} />
                ) : null}
              </View>
            </Pressable>
          )
        })}
      </SettingsGroupV3>
    </SettingsScreenV3>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  row: {
    alignItems: 'center',
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 62,
    paddingEnd: v3.space[14],
    paddingStart: v3.space[12],
    paddingVertical: v3.space[10],
  },
  pressed: { backgroundColor: v3.colors.line },
  square: {
    alignItems: 'center',
    borderRadius: v3.radius.icon,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  code: { ...v3.type.label, color: v3.colors.ink },
  title: { ...v3.type.button, color: v3.colors.fg, flex: 1 },
  ring: {
    alignItems: 'center',
    borderColor: v3.colors.muted,
    borderRadius: v3.radius.pill,
    borderWidth: 2.5,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  ringOn: { backgroundColor: v3.colors.blue, borderColor: v3.colors.blue },
}))
