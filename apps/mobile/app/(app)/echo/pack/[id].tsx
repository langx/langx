import Feather from '@expo/vector-icons/Feather'
import { SRS_RULES, type EchoPack } from '@langx/shared'
import { router, useLocalSearchParams } from 'expo-router'
import { Text, View } from 'react-native'
import { useEchoPacks, useStartPack } from '../../../../src/api/queries'
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
      router.push('/(app)/echo/session')
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
}))
