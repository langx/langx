import Feather from '@expo/vector-icons/Feather'
import type { EchoPack } from '@langx/shared'
import { router } from 'expo-router'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useEchoPacks } from '../../api/queries'
import { EchoHeaderV3 } from '../../components/echo/EchoHeaderV3'
import { LoadFailed } from '../../components/LoadFailed'
import { EmptyStateV3 } from '../../components/ui/EmptyStateV3'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { Screen } from '../../components/ui/Screen'
import { Skeleton } from '../../components/ui/Skeleton'
import { useLocale, useT } from '../../i18n'
import { useDisplayNames } from '../../i18n/displayNames'
import { packLabel } from '../../i18n/labels'
import { queryFailed } from '../../lib/listState'
import { goBackTo } from '../../lib/navigation'
import { makeStyles, useTheme } from '../../lib/theme'

const SKELETON_ROWS = ['a', 'b', 'c']

/**
 * Every pack for the languages you are learning, in the redesign's look
 * (`V-EchoPacks`), behind `flags.v3Home`.
 *
 * `echo/packs.tsx`'s list — a heading per language, a row per pack with how
 * far in you are — drawn as one grey block per language. A finished pack
 * keeps its row, with a check and the bar in the correction's green. While
 * the packs load the page is a skeleton, and with no network and nothing
 * held it says so, rather than either one reading as "no packs".
 */
export function EchoPacksScreenV3() {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const packs = useEchoPacks()

  const rows = packs.data?.items ?? []
  // The server returns them ordered; this only keeps each language's packs together.
  const groups: { lang: string; packs: EchoPack[] }[] = []
  for (const pack of rows) {
    const group = groups.find((entry) => entry.lang === pack.lang)
    if (group) group.packs.push(pack)
    else groups.push({ lang: pack.lang, packs: [pack] })
  }

  function body() {
    if (packs.data) {
      if (rows.length === 0) {
        return (
          <EmptyStateV3
            art="cards"
            line={t('echo.packsEmptyBody')}
            actionLabel={t('languages.addLearning')}
            onAction={() => router.push('/(app)/languages')}
          />
        )
      }
      return (
        <ScrollView contentContainerStyle={styles.list}>
          <Text style={styles.blurb}>{t('echo.packsBlurb')}</Text>
          {groups.map((group) => (
            <View key={group.lang} style={styles.group}>
              <Language lang={group.lang} />
              <View style={styles.block}>
                {group.packs.map((pack, index) => (
                  <PackRow key={pack._id} pack={pack} first={index === 0} />
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      )
    }
    if (queryFailed(packs)) return <LoadFailed onRetry={() => void packs.refetch()} />
    return (
      <View style={styles.list}>
        <Skeleton height={44} width={240} radius={v3.radius.icon} />
        {SKELETON_ROWS.map((key) => (
          <Skeleton key={key} height={76} radius={v3.radius.tile} />
        ))}
      </View>
    )
  }

  return (
    <Screen fluid ground={v3.colors.bg}>
      <EchoHeaderV3 title={t('echo.packs')} onBack={() => goBackTo('/(app)/(tabs)/echo')} />
      {body()}
    </Screen>
  )
}

function Language({ lang }: { lang: string }) {
  const styles = useStyles()
  const names = useDisplayNames()
  return (
    <Text style={styles.section} accessibilityRole="header">
      {names.language(lang)}
    </Text>
  )
}

function PackRow({ pack, first }: { pack: EchoPack; first: boolean }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const { isRtl } = useLocale()
  const t = useT()
  const done = Math.min(pack.startedCount, pack.itemCount)
  const finished = pack.itemCount > 0 && done >= pack.itemCount
  const progress = t('echo.packProgress', { done, total: pack.itemCount })

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/(app)/echo/pack/[id]', params: { id: pack._id } })}
      style={({ pressed }) => [styles.row, !first && styles.divided, pressed && styles.pressed]}
    >
      <View style={[styles.lead, finished && styles.leadDone]}>
        <Feather
          name={finished ? 'check' : 'layers'}
          size={v3.icon.lg}
          color={finished ? v3.colors.correction : v3.colors.echoText}
        />
      </View>
      <View style={styles.rowText}>
        <View style={styles.rowHead}>
          <Text style={styles.rowTitle}>{packLabel(t, pack)}</Text>
          <Text style={styles.rowSub}>{progress}</Text>
        </View>
        <ProgressBar
          value={pack.itemCount === 0 ? 0 : done / pack.itemCount}
          height={8}
          {...(finished ? { fillColor: v3.colors.correction } : {})}
          accessibilityLabel={progress}
        />
      </View>
      <Feather
        name={isRtl ? 'chevron-left' : 'chevron-right'}
        size={v3.icon.md}
        color={v3.colors.muted}
      />
    </Pressable>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  list: { gap: v3.space[8], paddingBottom: v3.space[24], paddingTop: v3.space[4] },
  blurb: { ...v3.type.callout, color: v3.colors.muted, paddingHorizontal: v3.space[4] },
  group: { gap: v3.space[8], paddingTop: v3.space[8] },
  section: { ...v3.type.headline, color: v3.colors.fg, paddingHorizontal: v3.space[4] },
  block: { backgroundColor: v3.colors.surface, borderRadius: v3.radius.tile, overflow: 'hidden' },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 76,
    padding: v3.space[12],
  },
  divided: { borderTopColor: v3.colors.line, borderTopWidth: 1 },
  pressed: { backgroundColor: v3.colors.line },
  lead: {
    alignItems: 'center',
    backgroundColor: v3.colors.echoTint,
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  leadDone: { backgroundColor: v3.colors.correctionTint },
  rowText: { flex: 1, gap: v3.space[6], minWidth: 0 },
  rowHead: {
    alignItems: 'baseline',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: v3.space[8],
    justifyContent: 'space-between',
  },
  rowTitle: { ...v3.type.button, color: v3.colors.fg },
  rowSub: { ...v3.type.caption, color: v3.colors.muted },
}))
