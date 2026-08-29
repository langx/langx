import type { ReactNode } from 'react'
import { View, type ViewStyle } from 'react-native'
import { makeStyles } from '../../lib/theme'

interface CardProps {
  children: ReactNode
  /**
   * Clips children to the radius. Needed by any card whose children draw their
   * own dividers to its edges — a settings group, a language list — and wrong
   * for one that casts a shadow, which `overflow: hidden` would clip away.
   */
  inset?: boolean
  elevated?: boolean
  style?: ViewStyle
}

/** `surface` on a 1px `border` at `radius.lg`. The app's one container shape. */
export function Card({ children, inset = false, elevated = false, style }: CardProps) {
  const styles = useStyles()
  return (
    <View style={[styles.card, inset && styles.inset, elevated && styles.elevated, style]}>
      {children}
    </View>
  )
}

const useStyles = makeStyles(({ colors, radius, cardShadow }) => ({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  inset: { overflow: 'hidden' },
  elevated: cardShadow,
}))
