import Feather from '@expo/vector-icons/Feather'
import { CARD_SHAPES, type CardShape } from '@langx/shared'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocale, useT, type MessageKey } from '../i18n'
import { makeStyles, useTheme } from '../lib/theme'
import { Button } from './ui/Button'
import { IconButton } from './ui/IconButton'

/**
 * Each shape's outline in its leading square, at the card's own ratio: the
 * row says "Story" and the mark shows what a story is, so nobody has to know
 * that a story is tall.
 */
const SHAPE_MARKS: Record<CardShape, { width: number; height: number }> = {
  story: { width: 13, height: 22 },
  square: { width: 18, height: 18 },
  wide: { width: 24, height: 14 },
}

/**
 * v3's drawing of `ShareCardSheet`'s choices, behind `flags.v3Home`: the
 * kit's sheet (handle, headline, a ✕), the three shapes as rows of one grey
 * block, and "Just the link" as the outlined pill under them — the quiet way
 * out the current look draws as a muted row.
 *
 * Drawing only. Which shape was picked, what the server is asked to draw and
 * when the platform share sheet opens stay in `ShareCardSheet`, so the iOS
 * dismissal wait there is the same in both looks.
 */
export function ShareCardChoicesV3({
  busy,
  labels,
  onPick,
  onLinkOnly,
  onClose,
}: {
  busy: CardShape | null
  labels: Record<CardShape, MessageKey>
  onPick: (shape: CardShape) => void
  onLinkOnly: () => void
  onClose: () => void
}) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()
  const insets = useSafeAreaInsets()
  const { isRtl } = useLocale()

  return (
    <Pressable style={styles.backdrop} accessibilityLabel={t('common.cancel')} onPress={onClose}>
      {/* Swallows the press so tapping the sheet does not close it. */}
      <Pressable
        style={[styles.sheet, { paddingBottom: insets.bottom + v3.space[16] }]}
        onPress={() => undefined}
      >
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            {t('share.cardTitle')}
          </Text>
          <IconButton icon="x" accessibilityLabel={t('common.close')} onPress={onClose} />
        </View>
        <Text style={styles.body}>{t('share.cardBody')}</Text>

        <View style={styles.group}>
          {CARD_SHAPES.map((shape, index) => (
            <Pressable
              key={shape}
              accessibilityRole="button"
              disabled={busy !== null}
              onPress={() => onPick(shape)}
              style={({ pressed }) => [
                styles.row,
                index > 0 && styles.rowDivided,
                pressed && styles.rowPressed,
              ]}
            >
              <View style={styles.markSquare}>
                <View style={[styles.mark, SHAPE_MARKS[shape]]} />
              </View>
              <Text style={styles.rowLabel}>{t(labels[shape])}</Text>
              {busy === shape ? (
                <ActivityIndicator color={v3.colors.fg} />
              ) : (
                <Feather
                  name={isRtl ? 'chevron-left' : 'chevron-right'}
                  size={v3.icon.md}
                  color={v3.colors.muted}
                />
              )}
            </Pressable>
          ))}
        </View>

        <Button
          variant="secondary"
          icon="link"
          label={t('share.justTheLink')}
          disabled={busy !== null}
          onPress={onLinkOnly}
          style={styles.link}
        />
      </Pressable>
    </Pressable>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  backdrop: { ...v3.elevation.overlay, flex: 1, justifyContent: 'flex-end' },
  // A phone-width column even on a wide window, like the kit's other sheets.
  sheet: {
    alignSelf: 'center',
    backgroundColor: v3.colors.bg,
    borderTopEndRadius: v3.radius.block,
    borderTopStartRadius: v3.radius.block,
    maxHeight: '80%',
    maxWidth: 560,
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[8],
    width: '100%',
  },
  handle: {
    alignSelf: 'center',
    backgroundColor: v3.colors.line,
    borderRadius: v3.radius.pill,
    height: 5,
    marginBottom: v3.space[4],
    width: 40,
  },
  header: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8] },
  title: { ...v3.type.headline, color: v3.colors.fg, flex: 1 },
  body: { ...v3.type.callout, color: v3.colors.muted, marginBottom: v3.space[12] },
  group: { backgroundColor: v3.colors.surface, borderRadius: v3.radius.tile, overflow: 'hidden' },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: v3.space[12],
    minHeight: 64,
    paddingEnd: v3.space[14],
    paddingStart: v3.space[12],
    paddingVertical: v3.space[8],
  },
  rowDivided: { borderTopColor: v3.colors.line, borderTopWidth: 1 },
  rowPressed: { backgroundColor: v3.colors.tabOn },
  markSquare: {
    alignItems: 'center',
    backgroundColor: v3.colors.bg,
    borderRadius: v3.radius.icon,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  mark: { borderColor: v3.colors.fg, borderRadius: v3.space[4], borderWidth: 2 },
  rowLabel: { ...v3.type.button, color: v3.colors.fg, flex: 1 },
  link: { marginTop: v3.space[16] },
}))
