import { Text, View } from 'react-native'
import { useQuota } from '../api/queries'
import { isDebugPanelEnabled } from '../lib/debugPanel'
import { formatQuota } from '../lib/quotaFormat'
import { makeStyles } from '../lib/theme'

/**
 * The viewer's own daily quotas, for looking at during development.
 *
 * Deliberately not a product surface: the numbers are useful while building
 * anything that spends a quota, and meaningless to someone who has never
 * heard the word. `isDebugPanelEnabled` keeps it out of every shipped build,
 * so nothing here needs product copy.
 */
export function DebugQuotaPanel() {
  const styles = useStyles()

  const quota = useQuota()
  if (!isDebugPanelEnabled()) return null

  const rows: [string, string][] = quota.data
    ? [
        ['New chats left today', formatQuota(quota.data.initiations)],
        ['Translations left today', formatQuota(quota.data.translations)],
        ['Attachments left today', formatQuota(quota.data.media)],
      ]
    : [['Quota', quota.isError ? 'unavailable' : 'loading…']]

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>DEBUG · quota</Text>
      {rows.map(([label, value]) => (
        <View key={label} style={styles.row}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{value}</Text>
        </View>
      ))}
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius }) => ({
  label: { ...font.caption, color: colors.textMuted },
  panel: {
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderStyle: 'dashed',
    borderWidth: 1,
    marginTop: spacing.xl,
    padding: spacing.md,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  title: { ...font.label, color: colors.textMuted },
  value: { ...font.caption, color: colors.text, fontVariant: ['tabular-nums'] },
}))
