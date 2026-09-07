import Feather from '@expo/vector-icons/Feather'
import { Pressable, Text, View } from 'react-native'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { useT } from '../../src/i18n'
import { appVersion } from '../../src/lib/appVersion'
import { LEGAL_LINKS } from '../../src/lib/externalLinks'
import { goBackTo } from '../../src/lib/navigation'
import { openExternal } from '../../src/lib/openExternal'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

/**
 * The legal links, on their own screen.
 *
 * Five rows that every reader scrolls past to reach Community and Account. They
 * have to be reachable — two stores require it — but they do not have to be in
 * the way, and one row that says what is behind it is as findable as five.
 */
export default function LegalScreen() {
  useScreenInteractive()
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()

  return (
    <Screen scroll>
      <ScreenHeader title={t('settings.legalSection')} onBack={() => goBackTo('/(app)/settings')} />
      <View>
        {LEGAL_LINKS.map((link) => (
          <Pressable
            key={link.url}
            accessibilityRole="link"
            onPress={() => void openExternal(link.url)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Text style={styles.rowTitle}>{t(link.labelKey as never)}</Text>
            {/* A share glyph rather than a chevron: every one of these rows leaves the app. */}
            <Feather name="share" size={18} color={colors.textFaint} />
          </Pressable>
        ))}
      </View>
      {/* The settings footer's version line, minus the build id — this is the licence page. */}
      <Text style={styles.footer}>
        LangX {appVersion()} {t('settings.licence')}
      </Text>
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
  footer: { color: colors.textFaint, fontSize: 13, marginTop: 20 },
}))
