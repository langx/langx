import Feather from '@expo/vector-icons/Feather'
import { attributedVoices, getLanguage } from '@langx/shared'
import { Pressable, Text, View } from 'react-native'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { useScreenInteractive } from '../../../src/hooks/useScreenInteractive'
import { useT } from '../../../src/i18n'
import { goBackTo } from '../../../src/lib/navigation'
import { openExternal } from '../../../src/lib/openExternal'
import { makeStyles, useTheme } from '../../../src/lib/theme'

/**
 * Who recorded the voices that read messages aloud.
 *
 * This page is an obligation rather than a courtesy. Most of the models we
 * ship are CC0, MIT or Apache-2.0 and ask nothing of us; ten are CC-BY or
 * CC-BY-SA, which permit the use we make of them *on condition* that we say
 * whose recording it was. Without this screen those ten could not be shipped.
 *
 * Built from `attributedVoices()` rather than a list written out here, so a
 * voice added to `SPEECH_VOICES` under a licence that needs crediting is
 * credited by having been added — there is no second place to remember. A test
 * pins that every such voice carries an `attribution`.
 *
 * The rows are not translated. They are a person's name, a licence identifier
 * and the address of a dataset; translating a licence name is how an
 * attribution stops being one. The two sentences around them are.
 */
export default function VoiceCreditsScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const credits = attributedVoices()

  return (
    <Screen scroll>
      <ScreenHeader
        title={t('settings.voiceCredits')}
        onBack={() => goBackTo('/(app)/settings/about')}
      />
      <Text style={styles.intro}>{t('settings.voiceCreditsBody')}</Text>
      <View>
        {credits.map((voice) => {
          // `attribution` is "<voice> (<locale>), <dataset url>" — the name is
          // already in the id beside it, so the row shows the address.
          const source = voice.attribution?.split(', ').pop() ?? ''
          const language = getLanguage(voice.lang)
          return (
            <Pressable
              key={voice.id}
              accessibilityRole="link"
              onPress={() => void openExternal(source)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.text}>
                <Text style={styles.rowTitle}>{language?.name ?? voice.lang}</Text>
                <Text style={styles.rowBody}>
                  {voice.id} · {voice.license}
                </Text>
              </View>
              <Feather name="share" size={18} color={colors.textFaint} />
            </Pressable>
          )
        })}
      </View>
      <Text style={styles.footer}>{t('settings.voiceCreditsEngines')}</Text>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, spacing }) => ({
  intro: { color: colors.textMuted, fontSize: 15, lineHeight: 21, paddingBottom: spacing.lg },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  pressed: { opacity: 0.6 },
  text: { flex: 1, gap: 2 },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  rowBody: { color: colors.textFaint, fontSize: 13 },
  footer: { color: colors.textFaint, fontSize: 13, lineHeight: 19, marginTop: 20 },
}))
