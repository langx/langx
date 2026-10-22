import Feather from '@expo/vector-icons/Feather'
import { Animated, Text } from 'react-native'
import { useChangeHaptic } from '../../hooks/useChangeHaptic'
import { useSelectPop } from '../../hooks/useSelectPop'
import { POP_FROM_GLYPH } from '../../lib/selectPop'
import { makeStyles, useTheme } from '../../lib/theme'
import { PressableScale } from '../ui/PressableScale'

/**
 * A language chip on the v3 Filters page (`V-Filters`): a 48pt pill, ink with
 * a tick when it is in the search, the grey surface when it is not — the
 * tick says it in the shape as well as the colour.
 *
 * The props are `Chip`'s that page passes, so the page hands either the same
 * values; it names the checkbox role so a screen reader hears each as on or off,
 * which the tick alone does not say.
 *
 * It shrinks under the finger like every v3 chip, its tick pops in when it is
 * put in the search, and the change ticks once.
 */
export function FilterChipV3({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const pop = useSelectPop(selected, POP_FROM_GLYPH)
  const markPress = useChangeHaptic(selected ? 'on' : 'off')
  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={() => {
        markPress()
        onPress()
      }}
      style={[styles.chip, selected && styles.on]}
    >
      {selected ? (
        <Animated.View style={{ transform: [{ scale: pop }] }}>
          <Feather name="check" size={v3.icon.sm} color={v3.colors.pillText} />
        </Animated.View>
      ) : null}
      <Text style={[styles.label, selected && styles.labelOn]}>{label}</Text>
    </PressableScale>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  chip: {
    alignItems: 'center',
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.pill,
    flexDirection: 'row',
    gap: v3.space[8],
    height: 48,
    paddingEnd: v3.space[20],
    paddingStart: v3.space[16],
  },
  on: { backgroundColor: v3.colors.pill, paddingStart: v3.space[14] },
  label: { ...v3.type.button, color: v3.colors.fg },
  labelOn: { color: v3.colors.pillText },
}))
