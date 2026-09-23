import { SRS_RULES, type EchoPack } from '@langx/shared'
import { router, useLocalSearchParams } from 'expo-router'
import { ScrollView, Text, View } from 'react-native'
import { useEchoPackItems, useEchoPacks, useStartPack } from '../../../../src/api/queries'
import { Button } from '../../../../src/components/ui/Button'
import { ProgressBar } from '../../../../src/components/ui/ProgressBar'
import { Screen } from '../../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader'
import { Skeleton } from '../../../../src/components/ui/Skeleton'
import { useT } from '../../../../src/i18n'
import { useDisplayNames } from '../../../../src/i18n/displayNames'
import { packLabel } from '../../../../src/i18n/labels'
import { showAlert } from '../../../../src/lib/alert'
import { track } from '../../../../src/lib/analytics'
import { goBackTo } from '../../../../src/lib/navigation'
import { makeStyles } from '../../../../src/lib/theme'
import { showToast } from '../../../../src/lib/toast'

/**
 * One pack: how far in, one button, and what the button would give you.
 *
 * The button says Start or Continue and does the same thing either way —
 * takes the next session's worth of items you have no card for. There is no
 * "restart", because there is nothing to restart: the cards you already have
 * are on their own schedule and a pack is only ever a source of new ones.
 *
 * Under it, those items and only those. The screen used to page the whole
 * pack, twenty rows at a time with a "21–40 of 271" — a table of contents for
 * a book nobody reads front to back. The question here is what the press
 * does, and the answer is ten rows.
 */
export default function EchoPackScreen() {
  const styles = useStyles()
  const t = useT()
  const names = useDisplayNames()
  const { id } = useLocalSearchParams<{ id: string }>()
  const packs = useEchoPacks()
  const start = useStartPack()
  const preview = useEchoPackItems(id)

  const pack: EchoPack | undefined = packs.data?.items.find((row) => row._id === id)

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
      // The pack's own language, not whatever is due across all of them: you
      // pressed start on a French pack, so the session that opens is French.
      router.push({ pathname: '/(app)/echo/session', params: { lang: pack.lang } })
    } catch {
      await showAlert(t('echo.addFailedTitle'), t('common.retry'))
    }
  }

  if (packs.isPending) {
    return (
      <Screen fluid>
        <ScreenHeader title={t('echo.packs')} onBack={() => goBackTo('/(app)/echo/packs')} />
        <View style={styles.body}>
          <Skeleton height={120} />
        </View>
      </Screen>
    )
  }

  if (!pack) {
    return (
      <Screen fluid>
        <ScreenHeader title={t('echo.packs')} onBack={() => goBackTo('/(app)/echo/packs')} />
        <View style={styles.body}>
          <Text style={styles.blurb}>{t('echo.packMissing')}</Text>
        </View>
      </Screen>
    )
  }

  const done = Math.min(pack.startedCount, pack.itemCount)
  const finished = done >= pack.itemCount
  const rows = preview.data?.items ?? []

  return (
    <Screen fluid>
      <ScreenHeader
        title={names.language(pack.lang)}
        onBack={() => goBackTo('/(app)/echo/packs')}
      />
      {/* Scrolling, which it has to be: the rows below do not fit a phone. */}
      <ScrollView contentContainerStyle={styles.body}>
        {/*
          The tab's tile, in the neutral grey: a pack is a thing you are part
          way through rather than a thing that is due, and yellow here would
          compete with the one button that starts it.
        */}
        <View style={styles.stage}>
          <View style={styles.tile}>
            <Text style={styles.tileCount}>{done}</Text>
            <Text style={styles.tileUnit}>{t('echo.packTileSub', { total: pack.itemCount })}</Text>
          </View>
          <View style={styles.caption}>
            <Text style={styles.level}>{packLabel(t, pack)}</Text>
            <Text style={styles.blurb}>{t('echo.packBlurb')}</Text>
          </View>
        </View>
        <ProgressBar
          value={pack.itemCount === 0 ? 0 : done / pack.itemCount}
          height={6}
          accessibilityLabel={t('echo.packProgress', { done, total: pack.itemCount })}
        />
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{pack.itemCount}</Text>
            <Text style={styles.statLabel}>{t('echo.statWords')}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{done}</Text>
            <Text style={styles.statLabel}>{t('echo.statYours')}</Text>
          </View>
        </View>
        <Button
          label={t(
            finished ? 'echo.packAllStarted' : done > 0 ? 'echo.packContinue' : 'echo.packStart',
          )}
          onPress={() => void begin()}
          loading={start.isPending}
          disabled={finished}
        />

        {/*
          The rows the button would add, under the button. Read the same way a
          started card would be — the back comes from `glossFor` with this
          reader's languages — so nothing here is a different rendering of the
          thing being decided about. Empty once the pack is finished, and the
          button above already says so.
        */}
        {rows.length > 0 ? (
          <View style={styles.preview}>
            <Text style={styles.section}>{t('echo.packNext')}</Text>
            {rows.map((row) => (
              <View key={row.index} style={styles.row}>
                <Text style={styles.front}>{row.text}</Text>
                {row.reading ? <Text style={styles.back}>{row.reading}</Text> : null}
                <Text style={styles.back}>{row.back}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  body: { gap: spacing.md, padding: spacing.lg },
  stage: { alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.lg },
  tile: {
    alignItems: 'center',
    backgroundColor: colors.fill,
    // 40, as the tab's tile: rounder than any card, squarer than a circle.
    borderRadius: 40,
    height: 160,
    justifyContent: 'center',
    width: 160,
  },
  tileCount: { ...font.title, color: colors.text, fontSize: 56, lineHeight: 64 },
  tileUnit: { color: colors.textFaint, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  caption: { alignItems: 'center', gap: spacing.xs },
  level: { ...font.heading, color: colors.text, textAlign: 'center' },
  blurb: {
    ...font.body,
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  stats: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
  },
  stat: { alignItems: 'center', flex: 1, gap: 2, paddingVertical: spacing.md },
  statValue: { ...font.heading, color: colors.text },
  statLabel: { color: colors.textFaint, fontSize: 12 },
  preview: { gap: spacing.sm, paddingTop: spacing.md },
  section: { color: colors.textFaint, fontSize: 13, fontWeight: '700' },
  row: { borderTopColor: colors.border, borderTopWidth: 1, gap: 2, paddingVertical: spacing.sm },
  front: { color: colors.text, fontSize: 15, fontWeight: '600' },
  back: { color: colors.textMuted, fontSize: 14 },
}))
