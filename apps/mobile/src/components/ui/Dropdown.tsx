import Feather from '@expo/vector-icons/Feather'
import { Modal, Pressable, Text, useWindowDimensions } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { dropdownLayout, type AnchorRect } from '../../lib/dropdownLayout'
import { makeStyles, useTheme } from '../../lib/theme'

export type { AnchorRect } from '../../lib/dropdownLayout'

interface DropdownProps<T extends string> {
  /** Where the control that opened it sits, in window coordinates. */
  anchor: AnchorRect
  options: readonly { value: T; label: string }[]
  selected: T | undefined
  onSelect: (value: T) => void
  onDismiss: () => void
  /** Names the list for a screen reader — the control's own label rarely does. */
  accessibilityLabel: string
}

/** A row's height, and the padding above and below the list. Used to place it. */
const ROW_HEIGHT = 44
const LIST_PADDING = 6
const MIN_WIDTH = 160

/**
 * A short list of choices, drawn against whatever opened it.
 *
 * A `Modal` rather than an absolutely positioned view in the composer, for the
 * same two reasons `MessageMenuHost` is one: it paints above the tab bar on
 * every platform without depending on mount order, and `onRequestClose` gives
 * Android's back button something to close. Both are things a plain overlay
 * would have to rebuild, and the second is easy to forget until a back press
 * leaves the app instead of the menu.
 *
 * Deliberately not the full `LanguagePicker` shape: that one searches 180
 * languages and needs a bounded height. This is for a handful of options that
 * already belong to you, where a search field would be furniture.
 */
export function Dropdown<T extends string>({
  anchor,
  options,
  selected,
  onSelect,
  onDismiss,
  accessibilityLabel,
}: DropdownProps<T>) {
  const styles = useStyles()
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const screen = useWindowDimensions()

  // Derived from the row count rather than measured, so the flip is decided
  // before the first paint. See `dropdownLayout`.
  const height = options.length * ROW_HEIGHT + LIST_PADDING * 2
  const width = Math.max(MIN_WIDTH, anchor.width)
  const { top, left } = dropdownLayout({
    anchor,
    screen: { width: screen.width, height: screen.height },
    insets: { top: insets.top, bottom: insets.bottom },
    menu: { width, height },
  })

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss} accessibilityRole="button">
        {/* Swallows the press so tapping the list itself does not close it. */}
        <Pressable
          style={[styles.menu, { top, left, width }]}
          onPress={() => {}}
          accessibilityRole="radiogroup"
          accessibilityLabel={accessibilityLabel}
        >
          {options.map((option) => {
            const on = option.value === selected
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => onSelect(option.value)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>
                  {option.label}
                </Text>
                {/* A tick, not a highlight: the chosen row has to stay legible
                    against the same background as the others. */}
                {on ? <Feather name="check" size={16} color={colors.text} /> : null}
              </Pressable>
            )
          })}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const useStyles = makeStyles(({ cardShadow, colors, font, radius, spacing }) => ({
  backdrop: { backgroundColor: colors.scrim, flex: 1 },
  menu: {
    ...cardShadow,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    paddingVertical: LIST_PADDING,
    position: 'absolute',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    height: ROW_HEIGHT,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
  },
  pressed: { opacity: 0.6 },
  label: { ...font.body, color: colors.textMuted, flexShrink: 1 },
  labelOn: { color: colors.text, fontWeight: '700' },
}))
