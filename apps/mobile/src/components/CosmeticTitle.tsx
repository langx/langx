import { Text, View } from 'react-native'
import type { Cosmetic } from '@langx/shared'
import { cosmeticLabel, useT } from '../i18n'
import { makeStyles } from '../lib/theme'

/**
 * A bought title, beside a display name.
 *
 * Its own component rather than a `Chip`: `Chip` is a *control* — it carries
 * `selected`, `onPress` and a pressed state — and this is a label. Reusing it
 * would put an interactive affordance on something nobody can press, on a
 * screen where every other chip does something.
 *
 * Deliberately quiet — an outlined tag in small capitals, no fill. A title is
 * worn by whoever paid the most, not earned by whoever taught the most, so it
 * should not out-shout the name it sits next to or the badges that do mean
 * something.
 */
export function CosmeticTitle({ cosmetic }: { cosmetic: Cosmetic | undefined }) {
  const styles = useStyles()
  const t = useT()
  if (!cosmetic) return null
  return (
    <View style={styles.chip}>
      <Text style={styles.label} numberOfLines={1}>
        {cosmeticLabel(t, cosmetic.id)}
      </Text>
    </View>
  )
}

const useStyles = makeStyles(({ colors, radius, spacing }) => ({
  chip: {
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
}))
