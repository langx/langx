import Feather from '@expo/vector-icons/Feather'
import { Pressable, Text, View } from 'react-native'
import { useContributors } from '../../src/api/queries'
import { Avatar } from '../../src/components/ui/Avatar'
import { Screen } from '../../src/components/ui/Screen'
import { ScreenHeader } from '../../src/components/ui/ScreenHeader'
import { KITCHEN_SECTIONS } from '../../src/lib/externalLinks'
import { goBackTo } from '../../src/lib/navigation'
import { openExternal } from '../../src/lib/openExternal'
import { makeStyles, useTheme } from '../../src/lib/theme'
import { useT } from '../../src/i18n'
import { useScreenInteractive } from '../../src/hooks/useScreenInteractive'

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
  useScreenInteractive()
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const contributors = useContributors().data
  // The contributors page is already a row in `KITCHEN_SECTIONS`; the strip
  // opens the same address rather than carrying a second copy of it.
  const contributorsUrl = KITCHEN_SECTIONS.flatMap((section) => section.rows).find(
    (row) => row.labelKey === 'kitchen.fundamentals',
  )?.url

  return (
    <Screen scroll>
      <ScreenHeader title={t('kitchen.title')} onBack={() => goBackTo('/(app)/settings')} />
      <Text style={styles.intro}>{t('kitchen.intro')}</Text>

      {/*
        The people, before the links: a row of faces, a "+N" for the rest, and
        the caption. Drawn only when the API has a list — an empty strip would
        say nobody built this.
      */}
      {contributors && contributors.total > 0 ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('kitchen.fundamentals')}
          onPress={() => contributorsUrl && void openExternal(contributorsUrl)}
          style={({ pressed }) => [styles.people, pressed && styles.pressed]}
        >
          <View style={styles.faces}>
            {contributors.top.map((person) => (
              <Avatar key={person.login} url={person.avatarUrl} name={person.login} size={32} />
            ))}
            {contributors.total > contributors.top.length ? (
              <View style={styles.more}>
                <Text style={styles.moreText}>
                  {t('kitchen.moreContributors', {
                    count: contributors.total - contributors.top.length,
                  })}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.caption}>{t('kitchen.fundamentals')}</Text>
        </Pressable>
      ) : null}

      {KITCHEN_SECTIONS.map((section) => (
        <View key={section.titleKey} style={styles.group}>
          <Text style={styles.kicker}>{t(section.titleKey)}</Text>
          {section.rows.map((row) => (
            <Pressable
              key={`${section.titleKey}-${row.label ?? row.labelKey}`}
              accessibilityRole="link"
              onPress={() => void openExternal(row.url)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text style={styles.rowTitle}>{row.label ?? t(row.labelKey as never)}</Text>
              {/* One glyph for every row — they all leave the app — rather than the table's own. */}
              <Feather name="share" size={16} color={colors.textFaint} />
            </Pressable>
          ))}
        </View>
      ))}

      {/*
        A licence condition, not a courtesy: the city list is CC BY 4.0 and the
        attribution has to be somewhere a person can find it. `docs/data-sources.md`
        records the other two places it appears.
      */}
      <Text style={styles.footer}>
        {t('kitchen.footer')} {t('kitchen.dataCredit')}
      </Text>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, spacing, radius }) => ({
  intro: { color: colors.textMuted, fontSize: 16, lineHeight: 24, marginTop: spacing.xs },
  people: { gap: spacing.sm, paddingBottom: 4, paddingTop: spacing.lg },
  faces: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  // The fill circle at the end of the row, sized like a face.
  more: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  moreText: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  caption: { color: colors.textFaint, fontSize: 13 },
  group: { marginTop: spacing.xl },
  kicker: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    paddingBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    justifyContent: 'space-between',
    paddingVertical: 13,
  },
  pressed: { opacity: 0.6 },
  rowTitle: { color: colors.text, flex: 1, fontSize: 16, fontWeight: '600' },
  footer: { color: colors.textFaint, fontSize: 13, lineHeight: 20, marginTop: spacing.xl },
}))
