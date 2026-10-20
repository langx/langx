import Feather from '@expo/vector-icons/Feather'
import { translateTargetFor, translateTargetOptions } from '@langx/shared'
import { Pressable, Text, View } from 'react-native'
import { useMe, useQuota, useUpdateProfile } from '../../api/queries'
import { SettingsGroupV3, SettingsScreenV3 } from '../../components/settings/v3/SettingsKitV3'
import { useScreenInteractive } from '../../hooks/useScreenInteractive'
import { useDisplayNames, useT } from '../../i18n'
import { makeStyles, useTheme } from '../../lib/theme'
import { partnerHueFor } from '../../lib/theme/partnerHue'
import { showToast } from '../../lib/toast'

/**
 * Which native language a translated message is shown in, in the redesign's
 * look (`V-TranslateLanguage`), behind `flags.v3Home`: one grey block of
 * radio rows that save on the tap, as `translate-language.tsx`'s do, with
 * the same request, the same refusal and the same count of what is left
 * today on a plan that has one. The drawing's example bubble is left out —
 * it is a picture of sample sentences, not anything this account has.
 */
export function TranslateLanguageScreenV3() {
  useScreenInteractive()
  const styles = useStyles()
  const { v3 } = useTheme()
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
    <SettingsScreenV3 title={t('settings.translateTo')} back="/(app)/settings/appearance">
      <Text style={styles.lead}>{t('settings.translateToScreenBody')}</Text>
      <SettingsGroupV3>
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
              <View style={[styles.square, { backgroundColor: v3.hues[partnerHueFor(code)] }]}>
                {/* The language's code: not a word, so not translated. */}
                <Text style={styles.code}>{code.slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={styles.text}>
                <Text style={styles.title}>{names.language(code)}</Text>
                {index === 0 ? (
                  <Text style={styles.sub}>{t('settings.translateToFirst')}</Text>
                ) : null}
              </View>
              <View style={[styles.ring, selected && styles.ringOn]}>
                {selected ? (
                  <Feather name="check" size={v3.icon.xs} color={v3.colors.onBlue} />
                ) : null}
              </View>
            </Pressable>
          )
        })}
      </SettingsGroupV3>
      {translationsLeft !== null ? (
        <Text style={styles.footer}>
          {t('settings.translationsLeft', { count: translationsLeft })}
        </Text>
      ) : null}
    </SettingsScreenV3>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  lead: { ...v3.type.callout, color: v3.colors.muted, paddingHorizontal: v3.space[4] },
  row: {
    alignItems: 'center',
    borderTopColor: v3.colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 66,
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
  text: { flex: 1, gap: 1, minWidth: 0 },
  title: { ...v3.type.button, color: v3.colors.fg },
  sub: { ...v3.type.caption, color: v3.colors.muted },
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
  footer: { ...v3.type.caption, color: v3.colors.muted, paddingHorizontal: v3.space[4] },
}))
