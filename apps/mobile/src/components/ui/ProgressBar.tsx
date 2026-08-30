import { View } from 'react-native'
import { makeStyles } from '../../lib/theme'

interface ProgressBarProps {
  /** Clamped to 0–1; callers compute it from real counts and can overshoot. */
  value: number
  height?: number
  /** Defaults to `primary`. Pass a tone when the bar belongs to one. */
  color?: string
  accessibilityLabel: string
}

export function ProgressBar({ value, height = 4, color, accessibilityLabel }: ProgressBarProps) {
  const styles = useStyles()
  const fraction = Math.max(0, Math.min(1, value))

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}
      style={[styles.track, { height }]}
    >
      <View
        style={[
          styles.fill,
          { width: `${fraction * 100}%` },
          color ? { backgroundColor: color } : null,
        ]}
      />
    </View>
  )
}

const useStyles = makeStyles(({ colors, radius }) => ({
  track: { backgroundColor: colors.fill, borderRadius: radius.pill, overflow: 'hidden' },
  // `accent` by default: v3's progress is blue — yellow belongs to the one
  // committing control on a screen, and a bar commits nothing.
  fill: { backgroundColor: colors.accent, borderRadius: radius.pill, height: '100%' },
}))
