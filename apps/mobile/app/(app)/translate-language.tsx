import { translateTargetFor, translateTargetOptions } from '@langx/shared'
import { Pressable, Text, View } from 'react-native'
import { useMe, useQuota, useUpdateProfile } from '../../src/api/queries'
import { Radio } from '../../src/components/ui/Radio'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'
import { useDisplayNames, useT } from '../../src/i18n'
import { goBackTo } from '../../src/lib/navigation'
import { makeStyles } from '../../src/lib/theme'
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
  const me = useMe()
  const update = useUpdateProfile()
  const quota = useQuota()

  const profile = me.data
  const options = profile ? translateTargetOptions(profile) : []
  const current = profile ? translateTargetFor(profile) : undefined
  // `null` is a plan with no limit, which has nothing to count down.
  const translationsLeft = quota.data?.translations.remaining ?? null

  return (
    <Screen scroll>
      <ScreenHeader
        title={t('settings.translateTo')}
        onBack={() => goBackTo('/(app)/settings/appearance')}
      />
      <Text style={styles.body}>{t('settings.translateToScreenBody')}</Text>
      <View>
        {options.map((code, index) => {
          const selected = current === code
          return (
            <Pressable
              key={code}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() =>
                update.mutate(
                  { settings: { translateTo: code } },
                  { onError: () => showToast(t('editProfile.saveFailed')) },
                )
              }
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{names.language(code)}</Text>
                {index === 0 ? (
                  <Text style={styles.rowSub}>{t('settings.translateToFirst')}</Text>
                ) : null}
              </View>
              <Radio selected={selected} />
            </Pressable>
          )
        })}
      </View>
      {translationsLeft !== null ? (
        <Text style={styles.footer}>
          {t('settings.translationsLeft', { count: translationsLeft })}
        </Text>
      ) : null}
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, spacing }) => ({
  body: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: spacing.md,
    marginTop: spacing.xs,
  },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    paddingVertical: 18,
  },
  pressed: { opacity: 0.6 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { color: colors.text, fontSize: 17, fontWeight: '600' },
  rowSub: { color: colors.textMuted, fontSize: 13 },
  footer: { color: colors.textFaint, fontSize: 14, lineHeight: 21, marginTop: 20 },
}))
