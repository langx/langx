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
 * Deliberately quiet. A title is worn by whoever paid the most, not earned by
 * whoever taught the most, so it should not out-shout the name it sits next to
 * or the badges that do mean something.
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

const useStyles = makeStyles(({ colors, font, radius, spacing }) => ({
  chip: {
    backgroundColor: colors.fill,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  label: { ...font.caption, color: colors.textMuted, fontWeight: '600' },
}))
