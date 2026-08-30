import type { ReactNode } from 'react'
import { View, type ViewStyle } from 'react-native'
import { makeStyles } from '../../lib/theme'

interface CardProps {
  children: ReactNode
  /**
   * Clips children to the radius. Needed by any group whose children draw
   * their own dividers to its edges — a settings group, a language list.
   */
  inset?: boolean
  /**
   * The rare true surface — a sheet, a floating panel. v3's default "card" is
   * no card at all: rows sit directly on the ground and dividers do the work,
   * so the plain variant draws nothing.
   */
  elevated?: boolean
  style?: ViewStyle
}

/**
 * v3 dissolved the card: what used to be `surface` on a 1px border is now an
 * invisible group on the white ground. The component stays because screens
 * still need the grouping seam — and because `elevated` still exists for the
 * few things that genuinely float.
 */
export function Card({ children, inset = false, elevated = false, style }: CardProps) {
  const styles = useStyles()
  return (
    <View style={[styles.card, inset && styles.inset, elevated && styles.elevated, style]}>
      {children}
    </View>
  )
}

const useStyles = makeStyles(({ colors, radius, cardShadow }) => ({
  card: { borderRadius: radius.lg },
  inset: { overflow: 'hidden' },
  elevated: { backgroundColor: colors.surface, ...cardShadow },
}))
