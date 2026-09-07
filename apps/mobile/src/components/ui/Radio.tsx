import { View } from 'react-native'
import { makeStyles } from '../../lib/theme'

/**
 * v3's radio mark: a 22px ring that turns `accent` and grows a dot when it is
 * the chosen one. Presentational only — the row it sits in is the pressable
 * and carries the `radio` role and the selected state, which is also why
 * there is no label here: the row's title is the label.
 *
 * Three screens draw a list of these — the theme, the app language and the
 * translation language — and they have to agree, which a shared glyph
 * guarantees and three inline circles did not.
 */
export function Radio({ selected }: { selected: boolean }) {
  const styles = useStyles()
  return (
    <View style={[styles.ring, selected && styles.ringOn]} accessibilityElementsHidden>
      {selected ? <View style={styles.dot} /> : null}
    </View>
  )
}

const useStyles = makeStyles(({ colors, radius }) => ({
  ring: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  ringOn: { borderColor: colors.accent },
  dot: { backgroundColor: colors.accent, borderRadius: radius.pill, height: 10, width: 10 },
}))
