import Feather from '@expo/vector-icons/Feather'
import { Text, View } from 'react-native'
import { useV3Home } from '../hooks/useV3Home'
import { useT } from '../i18n'
import { makeStyles, useTheme } from '../lib/theme'
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
  const { v3 } = useTheme()
  const v3Look = useV3Home()

  /*
   * No board draws this page. Under `flags.v3Home` it takes the shape of
   * `EmptyNoteV3` — its nearest v3 sibling, the other "nothing here" page —
   * a glyph on a grey disc, the sentence, one quiet button; the same words
   * and the same one thing to do.
   */
  if (v3Look) {
    return (
      <View style={styles.v3Root}>
        <View
          style={styles.v3Glyph}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Feather name="cloud-off" size={v3.icon.xxl} color={v3.colors.fg} />
        </View>
        <Text style={styles.v3Body}>{t('errors.loadFailed')}</Text>
        <Button
          variant="secondary"
          label={t('common.tryAgain')}
          onPress={onRetry}
          style={styles.v3Action}
        />
      </View>
    )
  }

  return (
    <View style={styles.root}>
      <Text style={styles.body}>{t('errors.loadFailed')}</Text>
      <Button variant="secondary" label={t('common.tryAgain')} onPress={onRetry} />
    </View>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, v3 }) => ({
  root: { alignItems: 'center', gap: spacing.lg, paddingHorizontal: spacing.xl, paddingTop: 80 },
  body: { ...font.body, color: colors.textMuted, textAlign: 'center' },

  // `EmptyNoteV3`'s measures.
  v3Root: {
    alignItems: 'center',
    gap: v3.space[16],
    paddingHorizontal: v3.space[24],
    paddingTop: 80,
  },
  v3Glyph: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  v3Body: { ...v3.type.callout, color: v3.colors.muted, textAlign: 'center' },
  v3Action: { minWidth: 200, width: 'auto' },
}))
