import Feather from '@expo/vector-icons/Feather'
import { SRS_RULES, type EchoPack } from '@langx/shared'
import { router } from 'expo-router'
import { ScrollView, Text, View } from 'react-native'
import { useEchoPackItems, useEchoPacks, useStartPack } from '../../api/queries'
import { EchoHeaderV3 } from '../../components/echo/EchoHeaderV3'
import { LoadFailed } from '../../components/LoadFailed'
import { Button } from '../../components/ui/Button'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { Screen } from '../../components/ui/Screen'
import { Skeleton } from '../../components/ui/Skeleton'
import { useLocale, useT } from '../../i18n'
import { useDisplayNames } from '../../i18n/displayNames'
import { packLabel } from '../../i18n/labels'
import { showAlert } from '../../lib/alert'
import { track } from '../../lib/analytics'
import { compactCount } from '../../lib/format'
import { queryFailed } from '../../lib/listState'
import { goBackTo } from '../../lib/navigation'
import { makeStyles, useTheme } from '../../lib/theme'
import { showToast } from '../../lib/toast'

/**
 * One pack, in the redesign's look (`V-EchoPack`), behind `flags.v3Home`.
 *
 * `echo/pack/[id].tsx`'s page: how far in, the two numbers, one button that
 * takes the next session's worth of cards and opens a review in the pack's
 * language, and the rows that press would add. The button is the yellow —
 * the page's one commit — and goes grey with "All started" once the pack is
 * yours. The request, its toasts and its alert are the current page's.
 */
export function EchoPackScreenV3({ id }: { id: string }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const t = useT()
  const { locale } = useLocale()
  const names = useDisplayNames()
  const packs = useEchoPacks()
  const start = useStartPack()
  const preview = useEchoPackItems(id)

  const pack: EchoPack | undefined = packs.data?.items.find((row) => row._id === id)
  const back = () => goBackTo('/(app)/echo/packs')

  async function begin(): Promise<void> {
    if (!pack) return
    try {
      const result = await start.mutateAsync({ packId: pack._id, count: SRS_RULES.sessionSize })
      if (result.started === 0) {
        // Nothing left to take. The cards are all made; the queue decides when.
        showToast(t('echo.packFinished'))
        return
      }
      track({
        name: 'echo_pack_started',
        properties: { lang: pack.lang, level: pack.level, count: result.started },
      })
      showToast(t('echo.packStarted', { count: result.started }))
      // The pack's own language, not whatever is due across all of them.
      router.push({ pathname: '/(app)/echo/session', params: { lang: pack.lang } })
    } catch {
      await showAlert(t('echo.addFailedTitle'), t('common.retry'))
    }
  }

  if (!packs.data) {
    return (
      <Screen fluid ground={v3.colors.bg}>
        <EchoHeaderV3 title={t('echo.packs')} onBack={back} />
        {queryFailed(packs) ? (
          <LoadFailed onRetry={() => void packs.refetch()} />
        ) : (
          <View style={styles.body}>
            <Skeleton height={200} radius={v3.radius.block} />
            <Skeleton height={56} radius={v3.radius.pill} />
          </View>
        )}
      </Screen>
    )
  }

  if (!pack) {
    return (
      <Screen fluid ground={v3.colors.bg}>
        <EchoHeaderV3 title={t('echo.packs')} onBack={back} />
        <Text style={styles.missing}>{t('echo.packMissing')}</Text>
      </Screen>
    )
  }

  const done = Math.min(pack.startedCount, pack.itemCount)
  const finished = done >= pack.itemCount
  const rows = preview.data?.items ?? []
  const progress = t('echo.packProgress', { done, total: pack.itemCount })

  return (
    <Screen fluid ground={v3.colors.bg}>
      <EchoHeaderV3 title={names.language(pack.lang)} onBack={back} />
      <ScrollView contentContainerStyle={styles.body}>
        {/*
          Grey, not a hue: a pack is a thing you are part way through rather
          than a thing that is due, and a colour here would compete with the
          one button that starts it.
        */}
        <View style={styles.hero}>
          <View style={styles.heroHead}>
            <View style={styles.heroText}>
              <Text style={styles.level}>{packLabel(t, pack)}</Text>
              <View style={styles.countRow}>
                <Text style={styles.count}>{compactCount(done, locale)}</Text>
                <Text style={styles.countUnit}>
                  {t('echo.packTileSub', { total: pack.itemCount })}
                </Text>
              </View>
            </View>
            <View style={styles.heroMark}>
              <Feather name="layers" size={v3.icon.xl} color={v3.colors.echoText} />
            </View>
          </View>
          <ProgressBar
            value={pack.itemCount === 0 ? 0 : done / pack.itemCount}
            height={10}
            accessibilityLabel={progress}
          />
          <Text style={styles.blurb}>{t('echo.packBlurb')}</Text>
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{compactCount(pack.itemCount, locale)}</Text>
            <Text style={styles.statLabel}>{t('echo.statWords')}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{compactCount(done, locale)}</Text>
            <Text style={styles.statLabel}>{t('echo.statYours')}</Text>
          </View>
        </View>

        <Button
          label={t(
            finished ? 'echo.packAllStarted' : done > 0 ? 'echo.packContinue' : 'echo.packStart',
          )}
          icon={finished ? 'check' : 'play'}
          {...(finished ? { variant: 'secondary' as const } : {})}
          onPress={() => void begin()}
          loading={start.isPending}
          disabled={finished}
        />

        {/* The rows the button would add, read the way a started card would be. */}
        {rows.length > 0 ? (
          <View style={styles.preview}>
            <View style={styles.previewHead}>
              <Text style={styles.section} accessibilityRole="header">
                {t('echo.packNext')}
              </Text>
              <Text style={styles.previewCount}>{t('echo.cardCount', { count: rows.length })}</Text>
            </View>
            <View style={styles.previewBlock}>
              {rows.map((row, index) => (
                <View key={row.index} style={[styles.row, index > 0 && styles.divided]}>
                  <Text style={styles.front}>{row.text}</Text>
                  {row.reading ? <Text style={styles.back}>{row.reading}</Text> : null}
                  <Text style={styles.back}>{row.back}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  body: { gap: v3.space[10], paddingBottom: v3.space[24], paddingTop: v3.space[6] },
  missing: { ...v3.type.callout, color: v3.colors.muted, paddingTop: v3.space[16] },
  hero: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.block,
    gap: v3.space[12],
    paddingBottom: v3.space[20],
    paddingHorizontal: v3.space[20],
    paddingTop: v3.space[16],
  },
  heroHead: { alignItems: 'flex-start', flexDirection: 'row', gap: v3.space[12] },
  heroText: { flex: 1, gap: v3.space[2], minWidth: 0 },
  level: { ...v3.type.headline, color: v3.colors.fg },
  countRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: v3.space[8],
    marginTop: v3.space[6],
  },
  count: { ...v3.type.display, color: v3.colors.fg, fontSize: 64, lineHeight: 64 },
  countUnit: {
    ...v3.type.body,
    color: v3.colors.muted,
    fontWeight: '700',
    paddingBottom: v3.space[6],
  },
  heroMark: {
    alignItems: 'center',
    backgroundColor: v3.colors.echoTint,
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  blurb: { ...v3.type.callout, color: v3.colors.muted },
  stats: { flexDirection: 'row', gap: v3.space[8] },
  stat: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.card,
    flex: 1,
    paddingHorizontal: v3.space[14],
    paddingVertical: v3.space[10],
  },
  statValue: { ...v3.type.headline, color: v3.colors.fg },
  statLabel: { ...v3.type.caption, color: v3.colors.muted },
  preview: { gap: v3.space[8], paddingTop: v3.space[6] },
  previewHead: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: v3.space[4],
  },
  section: { ...v3.type.headline, color: v3.colors.fg },
  previewCount: { ...v3.type.caption, color: v3.colors.muted },
  previewBlock: {
    borderColor: v3.colors.line,
    borderRadius: v3.radius.tile,
    borderWidth: 2,
    overflow: 'hidden',
  },
  row: { gap: 1, paddingHorizontal: v3.space[16], paddingVertical: v3.space[10] },
  divided: { borderTopColor: v3.colors.line, borderTopWidth: 1 },
  front: { ...v3.type.button, color: v3.colors.fg },
  back: { ...v3.type.callout, color: v3.colors.muted },
}))
