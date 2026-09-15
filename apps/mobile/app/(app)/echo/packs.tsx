import Feather from '@expo/vector-icons/Feather'
import type { EchoPack } from '@langx/shared'
import { router } from 'expo-router'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useEchoPacks } from '../../../src/api/queries'
import { EmptyState } from '../../../src/components/ui/EmptyState'
import { LoadFailed } from '../../../src/components/LoadFailed'
import { ProgressBar } from '../../../src/components/ui/ProgressBar'
import { Screen } from '../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../src/components/ui/ScreenHeader'
import { Skeleton } from '../../../src/components/ui/Skeleton'
import { useT } from '../../../src/i18n'
import { useDisplayNames } from '../../../src/i18n/displayNames'
import { levelLabel } from '../../../src/i18n/labels'
import { goBackTo } from '../../../src/lib/navigation'
import { makeStyles, useTheme } from '../../../src/lib/theme'

/**
 * Every pack for the languages you are learning, a heading per language.
 *
 * It was three rows in the tab's list footer until the tab became a stage.
 * Grouped rather than a flat list because a pack is a language *and* a level:
 * flat, every row of the same language read the same and was told apart only
 * by a count — which is the bug the level label fixed once already.
 */
export default function EchoPacksScreen() {
  const styles = useStyles()
  const t = useT()
  const packs = useEchoPacks()

  const rows = packs.data?.items ?? []
  // The server returns them ordered; this only keeps each language's packs
  // together, in the order the first one arrived in.
  const groups: { lang: string; packs: EchoPack[] }[] = []
  for (const pack of rows) {
    const group = groups.find((entry) => entry.lang === pack.lang)
    if (group) group.packs.push(pack)
    else groups.push({ lang: pack.lang, packs: [pack] })
  }

  return (
    <Screen fluid>
      <ScreenHeader title={t('echo.packs')} onBack={() => goBackTo('/(app)/(tabs)/echo')} />
      {packs.isPending ? (
        <View style={styles.loading}>
          <Skeleton height={72} />
          <Skeleton height={72} />
          <Skeleton height={72} />
        </View>
      ) : packs.isError ? (
        <LoadFailed onRetry={() => void packs.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon="layers"
          title={t('echo.packsEmptyTitle')}
          body={t('echo.packsEmptyBody')}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <Text style={styles.blurb}>{t('echo.packsBlurb')}</Text>
          {groups.map((group) => (
            <View key={group.lang}>
              <Language lang={group.lang} />
              {group.packs.map((pack) => (
                <PackRow key={pack._id} pack={pack} />
              ))}
            </View>
          ))}
        </ScrollView>
      )}
    </Screen>
  )
}

function Language({ lang }: { lang: string }) {
  const styles = useStyles()
  const names = useDisplayNames()
  return <Text style={styles.section}>{names.language(lang)}</Text>
}

function PackRow({ pack }: { pack: EchoPack }) {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const done = Math.min(pack.startedCount, pack.itemCount)
  const progress = t('echo.packProgress', { done, total: pack.itemCount })

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/(app)/echo/pack/[id]', params: { id: pack._id } })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{levelLabel(t, pack.level)}</Text>
        <ProgressBar
          value={pack.itemCount === 0 ? 0 : done / pack.itemCount}
          height={6}
          accessibilityLabel={progress}
        />
        <Text style={styles.rowSub}>{progress}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={colors.textFaint} />
    </Pressable>
  )
}

const useStyles = makeStyles(({ colors, spacing }) => ({
  loading: { gap: spacing.sm, paddingTop: spacing.sm },
  list: { paddingBottom: spacing.xl },
  blurb: { color: colors.textMuted, fontSize: 15, lineHeight: 22, paddingBottom: spacing.xs },
  section: {
    color: colors.textFaint,
    fontSize: 13,
    fontWeight: '700',
    paddingBottom: spacing.xs,
    paddingTop: spacing.lg,
  },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: 14,
  },
  rowText: { flex: 1, gap: 6 },
  rowTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  rowSub: { color: colors.textMuted, fontSize: 13 },
  pressed: { opacity: 0.6 },
}))
