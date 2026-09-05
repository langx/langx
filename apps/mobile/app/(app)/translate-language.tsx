import Feather from '@expo/vector-icons/Feather'
import { translateTargetFor, translateTargetOptions } from '@langx/shared'
import { Text, View } from 'react-native'
import { useMe, useUpdateProfile } from '../../src/api/queries'
import { ListRow } from '../../src/components/ui/ListRow'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'
import { useDisplayNames, useT } from '../../src/i18n'
import { goBackTo } from '../../src/lib/navigation'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { showToast } from '../../src/lib/toast'

/**
 * Which of your native languages a translated message is shown in.
 *
 * Only the native ones are offered — translating into a language you are
 * learning would defeat the purpose — and only the ones with a written form.
 * The first is the default, which is what almost everyone wants; the screen
 * exists for the bilingual, who read one of their languages faster than the
 * other. An account setting, so it follows the person to every device.
 */
export default function TranslateLanguageScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const t = useT()
  const names = useDisplayNames()
  const { colors } = useTheme()
  const me = useMe()
  const update = useUpdateProfile()

  const profile = me.data
  const options = profile ? translateTargetOptions(profile) : []
  const current = profile ? translateTargetFor(profile) : undefined

  return (
    <Screen scroll>
      <ScreenHeader
        title={t('settings.translateTo')}
        onBack={() => goBackTo('/(app)/settings/appearance')}
      />
      <Text style={styles.body}>{t('settings.translateToScreenBody')}</Text>
      <View>
        {options.map((code, index) => (
          <ListRow
            key={code}
            title={names.language(code)}
            subtitle={index === 0 ? t('settings.translateToFirst') : undefined}
            last={index === options.length - 1}
            onPress={() =>
              update.mutate(
                { settings: { translateTo: code } },
                { onError: () => showToast(t('editProfile.saveFailed')) },
              )
            }
            accessory={
              current === code ? (
                <Feather name="check" size={18} color={colors.accent} />
              ) : undefined
            }
          />
        ))}
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  body: {
    ...font.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
}))
