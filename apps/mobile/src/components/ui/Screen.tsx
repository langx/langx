import type { ReactNode } from 'react'
import { Platform, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, layout, spacing } from '../../lib/theme'

interface ScreenProps {
  children: ReactNode
  scroll?: boolean
  /** Turn off the centred max-width column — chat wants the full height. */
  fluid?: boolean
  style?: ViewStyle
}

/**
 * Every screen's outer shell: safe-area padding on phones, a centred column on
 * wide browsers. Without the column, the same layout that reads well on a
 * 390px phone spreads a single line of text across a desktop monitor.
 */
export function Screen({ children, scroll = false, fluid = false, style }: ScreenProps) {
  const insets = useSafeAreaInsets()
  const padding = {
    paddingTop: insets.top,
    paddingBottom: insets.bottom,
  }

  const inner = <View style={[styles.column, fluid && styles.fluid, style]}>{children}</View>

  if (scroll) {
    return (
      <ScrollView
        style={[styles.root, padding]}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {inner}
      </ScrollView>
    )
  }
  return <View style={[styles.root, padding, styles.centre]}>{inner}</View>
}

const styles = StyleSheet.create({
  root: { backgroundColor: colors.bg, flex: 1 },
  centre: { alignItems: 'center' },
  scrollContent: { alignItems: 'center', paddingVertical: spacing.lg },
  column: { maxWidth: layout.maxWidth, paddingHorizontal: spacing.lg, width: '100%' },
  fluid: { flex: 1, maxWidth: Platform.OS === 'web' ? layout.maxWidth : undefined },
})
