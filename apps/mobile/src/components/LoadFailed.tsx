import { Text, View } from 'react-native'
import { useT } from '../i18n'
import { makeStyles } from '../lib/theme'
import { Button } from './ui/Button'

/**
 * What a screen shows when the thing it is built on did not arrive.
 *
 * Deliberately plain, and deliberately not an error message from the server:
 * the person reading it can do exactly one thing about it, so the screen
 * offers that one thing and nothing else. `AppGate`'s `Blocked` is the same
 * shape for the two cases where the app must stop entirely.
 */
export function LoadFailed({ onRetry }: { onRetry: () => void }) {
  const t = useT()
  const styles = useStyles()

  return (
    <View style={styles.root}>
      <Text style={styles.body}>{t('errors.loadFailed')}</Text>
      <Button variant="secondary" label={t('common.tryAgain')} onPress={onRetry} />
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing }) => ({
  root: { alignItems: 'center', gap: spacing.lg, paddingHorizontal: spacing.xl, paddingTop: 80 },
  body: { ...font.body, color: colors.textMuted, textAlign: 'center' },
}))
