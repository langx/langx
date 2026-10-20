import Feather from '@expo/vector-icons/Feather'
import { Pressable, Text } from 'react-native'
import { makeStyles, useTheme } from '../../lib/theme'

/**
 * A language chip on the v3 Filters page (`V-Filters`): a 48pt pill, ink with
 * a tick when it is in the search, the grey surface when it is not — the
 * tick says it in the shape as well as the colour.
 *
 * The props are `Chip`'s that page passes, so the page hands either the same
 * values; like the chips it replaces there, it names no role.
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
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.on, pressed && styles.pressed]}
    >
      {selected ? <Feather name="check" size={v3.icon.sm} color={v3.colors.pillText} /> : null}
      <Text style={[styles.label, selected && styles.labelOn]}>{label}</Text>
    </Pressable>
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
  pressed: { opacity: 0.7 },
  label: { ...v3.type.button, color: v3.colors.fg },
  labelOn: { color: v3.colors.pillText },
}))
