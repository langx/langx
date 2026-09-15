import Feather from '@expo/vector-icons/Feather'
import { ECHO_PACK_PREVIEW_PAGE, SRS_RULES, type EchoPack } from '@langx/shared'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useEchoPackItems, useEchoPacks, useStartPack } from '../../../../src/api/queries'
import { Button } from '../../../../src/components/ui/Button'
import { ProgressBar } from '../../../../src/components/ui/ProgressBar'
import { Screen } from '../../../../src/components/ui/Screen'
import { ScreenHeader } from '../../../../src/components/ui/ScreenHeader'
import { Skeleton } from '../../../../src/components/ui/Skeleton'
import { useT } from '../../../../src/i18n'
import { useDisplayNames } from '../../../../src/i18n/displayNames'
import { showAlert } from '../../../../src/lib/alert'
import { goBackTo } from '../../../../src/lib/navigation'
import { makeStyles, useTheme } from '../../../../src/lib/theme'
import { showToast } from '../../../../src/lib/toast'

/**
 * One pack: how far in, and one button.
 *
 * The button says Start or Continue and does the same thing either way —
 * takes the next session's worth of items you have no card for. There is no
 * "restart", because there is nothing to restart: the cards you already have
 * are on their own schedule and a pack is only ever a source of new ones.
 */
export default function EchoPackScreen() {
  const styles = useStyles()
  const { colors } = useTheme()
  const t = useT()
  const names = useDisplayNames()
  const { id } = useLocalSearchParams<{ id: string }>()
  const packs = useEchoPacks()
  const start = useStartPack()
  const [offset, setOffset] = useState(0)
  const preview = useEchoPackItems(id, offset)

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
        <ScreenHeader title={t('echo.packs')} onBack={() => goBackTo('/(app)/(tabs)/echo')} />
        <View style={styles.body}>
          <Skeleton height={120} />
        </View>
      </Screen>
    )
  }

  if (!pack) {
    return (
      <Screen fluid>
        <ScreenHeader title={t('echo.packs')} onBack={() => goBackTo('/(app)/(tabs)/echo')} />
        <View style={styles.body}>
          <Text style={styles.blurb}>{t('echo.packMissing')}</Text>
        </View>
      </Screen>
    )
  }

  const done = Math.min(pack.startedCount, pack.itemCount)
  const finished = done >= pack.itemCount
  const rows = preview.data?.items ?? []
  const lastPage = offset + rows.length >= (preview.data?.total ?? pack.itemCount)

  return (
    <Screen fluid>
      <ScreenHeader
        title={names.language(pack.lang)}
        onBack={() => goBackTo('/(app)/(tabs)/echo')}
      />
      <View style={styles.body}>
        <View style={styles.badgeRow}>
          <Feather name="layers" size={16} color={colors.accent} />
          <Text style={styles.level}>{t(`level.${pack.level}` as never)}</Text>
        </View>
        <Text style={styles.blurb}>{t('echo.packBlurb')}</Text>
        <ProgressBar
          value={pack.itemCount === 0 ? 0 : done / pack.itemCount}
          height={6}
          accessibilityLabel={t('echo.packProgress', { done, total: pack.itemCount })}
        />
        <Text style={styles.progress}>
          {t('echo.packProgress', { done, total: pack.itemCount })}
        </Text>
        <Button
          label={t(
            finished ? 'echo.packAllStarted' : done > 0 ? 'echo.packContinue' : 'echo.packStart',
          )}
          onPress={() => void begin()}
          loading={start.isPending}
          disabled={finished}
        />

        {/*
          What the pack actually is, under the button that offers it. Read the
          same way a started card would be — the back comes from `glossFor`
          with this reader's languages — so nothing here is a different
          rendering of the thing being decided about.
        */}
        {rows.length > 0 ? (
          <View style={styles.preview}>
            <Text style={styles.section}>{t('echo.packContains')}</Text>
            {rows.map((row) => (
              <View key={row.index} style={styles.row}>
                <Text style={styles.front}>{row.text}</Text>
                <Text style={styles.back}>{row.back}</Text>
              </View>
            ))}
            <View style={styles.pager}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: offset === 0 }}
                disabled={offset === 0}
                hitSlop={8}
                onPress={() => setOffset(Math.max(0, offset - ECHO_PACK_PREVIEW_PAGE))}
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <Text style={[styles.pageLink, offset === 0 && styles.pageLinkOff]}>
                  {t('echo.packPagePrev')}
                </Text>
              </Pressable>
              <Text style={styles.range}>
                {t('echo.packRange', {
                  from: offset + 1,
                  to: offset + rows.length,
                  total: preview.data?.total ?? pack.itemCount,
                })}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: lastPage }}
                disabled={lastPage}
                hitSlop={8}
                onPress={() => setOffset(offset + ECHO_PACK_PREVIEW_PAGE)}
                style={({ pressed }) => [pressed && styles.pressed]}
              >
                <Text style={[styles.pageLink, lastPage && styles.pageLinkOff]}>
                  {t('echo.packPageNext')}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </Screen>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  body: { gap: spacing.md, padding: spacing.lg },
  badgeRow: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  level: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  blurb: { ...font.body, color: colors.textMuted, fontSize: 15, lineHeight: 22 },
  progress: { color: colors.textFaint, fontSize: 13 },
  preview: { gap: spacing.sm, paddingTop: spacing.md },
  section: { color: colors.textFaint, fontSize: 13, fontWeight: '700' },
  row: { borderTopColor: colors.border, borderTopWidth: 1, gap: 2, paddingVertical: spacing.sm },
  front: { color: colors.text, fontSize: 15, fontWeight: '600' },
  back: { color: colors.textMuted, fontSize: 14 },
  pager: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  pageLink: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  pageLinkOff: { color: colors.textFaint },
  range: { color: colors.textFaint, fontSize: 13 },
  pressed: { opacity: 0.6 },
}))
