import Feather from '@expo/vector-icons/Feather'
import { Text, View } from 'react-native'
import { Card } from '../../src/components/ui/Card'
import { ListRow } from '../../src/components/ui/ListRow'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { KITCHEN_SECTIONS } from '../../src/lib/externalLinks'
import { goBackTo } from '../../src/lib/navigation'
import { openExternal } from '../../src/lib/openExternal'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { useT } from '../../src/i18n'

/**
 * Our Kitchen — where the project is made, and everything around it: the people
 * who built it, the places to support it, and the pages that say what it is.
 *
 * v1 had this page and v2 lost it, which cost more than a list of links: it is
 * the only route from the app to the Discord, to the backers, and to the
 * repository this whole thing is open about. Every row leaves the app, so
 * every row goes through the in-app browser rather than switching away.
 */
export default function KitchenScreen() {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()

  return (
    <Screen scroll fluid>
      <ScreenHeader title={t('kitchen.title')} onBack={() => goBackTo('/(app)/settings')} />
      <Text style={styles.intro}>{t('kitchen.intro')}</Text>

      {KITCHEN_SECTIONS.map((section) => (
        <View key={section.titleKey}>
          <Text style={styles.section}>{t(section.titleKey)}</Text>
          <Card inset>
            {section.rows.map((row, index) => (
              <ListRow
                key={`${section.titleKey}-${row.label ?? row.labelKey}`}
                title={row.label ?? t(row.labelKey as never)}
                onPress={() => void openExternal(row.url)}
                last={index === section.rows.length - 1}
                accessory={
                  <Feather
                    // The icon set types its own names; the link table is plain
                    // data and does not import them.
                    name={row.icon as never}
                    size={17}
                    color={colors.textMuted}
                  />
                }
              />
            ))}
          </Card>
        </View>
      ))}

      <Text style={styles.footer}>{t('kitchen.footer')}</Text>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  intro: { ...font.body, color: colors.textMuted, marginTop: spacing.xs },
  section: {
    ...font.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginTop: spacing.xl,
    paddingStart: spacing.xs,
  },
  footer: {
    ...font.caption,
    color: colors.textFaint,
    marginBottom: spacing.xxl,
    marginTop: spacing.xl,
    textAlign: 'center',
  },
}))
