import Feather from '@expo/vector-icons/Feather'
import type { CallMedia } from '@langx/shared'
import { Modal, Pressable, Text, View, useWindowDimensions } from 'react-native'
import { useT } from '../../i18n'
import type { AnchorRect } from '../../lib/messageMenu'
import { makeStyles, useTheme } from '../../lib/theme'

const WIDTH = 220
const EDGE = 8

/**
 * The two kinds of call, dropped down from the header's one call button.
 *
 * One button rather than a phone and a camera side by side: a thread's header
 * already holds a back arrow, a face, a name, a presence line and the menu,
 * and two more icons pushed the name off a narrow phone. The choice is made
 * after the press, where there is room to say it in words.
 *
 * Under the button, lined up with its trailing edge and kept on screen —
 * which, in a right-to-left layout, is what puts it under the button on the
 * left. A `Modal`, so a tap anywhere else closes it without reaching the
 * thread underneath.
 */
export function CallMenu({
  anchor,
  onPick,
  onClose,
}: {
  anchor: AnchorRect | null
  onPick: (media: CallMedia) => void
  onClose: () => void
}) {
  const t = useT()
  const styles = useStyles()
  const { colors } = useTheme()
  const window = useWindowDimensions()
  if (!anchor) return null

  const left = Math.min(
    Math.max(EDGE, anchor.x + anchor.width - WIDTH),
    window.width - WIDTH - EDGE,
  )
  const top = anchor.y + anchor.height + 4

  const row = (media: CallMedia, icon: 'phone' | 'video', label: string) => (
    <Pressable
      accessibilityRole="menuitem"
      onPress={() => {
        onClose()
        onPick(media)
      }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Feather name={icon} size={18} color={colors.text} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  )

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel')}
        style={styles.backdrop}
        onPress={onClose}
      />
      <View accessibilityRole="menu" style={[styles.card, { left, top }]}>
        {row('audio', 'phone', t('calls.voiceCall'))}
        <View style={styles.divider} />
        {row('video', 'video', t('calls.videoCall'))}
      </View>
    </Modal>
  )
}

const useStyles = makeStyles(({ colors, font, spacing, radius, cardShadow }) => ({
  backdrop: { bottom: 0, left: 0, position: 'absolute', right: 0, top: 0 },
  card: {
    ...cardShadow,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'absolute',
    width: WIDTH,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
  },
  pressed: { backgroundColor: colors.fill },
  label: { ...font.body, color: colors.text },
  divider: { backgroundColor: colors.border, height: 1 },
}))
