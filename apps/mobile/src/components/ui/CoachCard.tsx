import Feather from '@expo/vector-icons/Feather'
import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { useT } from '../../i18n'
import { makeStyles, useTheme, type PartnerHue } from '../../lib/theme'
import { Button } from './Button'
import { IconButton } from './IconButton'

type Glyph = keyof typeof Feather.glyphMap

interface CoachCardProps {
  /** A glyph in a disc of `hue`. Ignored when there is an `illustration`. */
  icon?: Glyph
  /** The disc's colour, with the glyph in ink on it. Mint, like the drawings' tip. */
  hue?: PartnerHue
  /** A drawing of its own in the glyph's place — an `EmptyArt`, a badge. */
  illustration?: ReactNode
  title?: string
  body: string
  /** The one thing the card suggests: "Show me". */
  action: { label: string; onPress: () => void; icon?: Glyph }
  /**
   * Sends the card away. Always a button — the ✕ in the corner — and never a
   * swipe alone: a gesture is invisible until somebody already knows it, and
   * a screen reader cannot perform one. Whether it comes back is the caller's.
   */
  onDismiss: () => void
}

/**
 * A suggestion with one way to act on it and one way to send it away — the
 * drawings' "Correct a sentence · Long-press any message, then Correct ·
 * Show me".
 *
 * Plain on the grey block, the text in `fg`: a coach card is neither the
 * correction's green nor Copilot's blue (see `Callout`), and it has to be
 * the quietest block on its screen, below whatever the screen is for. Its
 * action is the ink pill rather than yellow for the same reason.
 */
export function CoachCard({
  icon,
  hue = 'mint',
  illustration,
  title,
  body,
  action,
  onDismiss,
}: CoachCardProps) {
  const t = useT()
  const styles = useStyles()
  const { v3 } = useTheme()

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {illustration ??
          (icon ? (
            <View style={[styles.disc, { backgroundColor: v3.hues[hue] }]}>
              <Feather name={icon} size={v3.icon.lg} color={v3.colors.ink} />
            </View>
          ) : null)}
        <View style={styles.words}>
          {title ? (
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
          ) : null}
          <Text style={styles.body}>{body}</Text>
        </View>
        <IconButton
          icon="x"
          iconSize={v3.icon.lg}
          accessibilityLabel={t('tips.dismiss')}
          onPress={onDismiss}
        />
      </View>
      <Button
        variant="ink"
        size="small"
        label={action.label}
        {...(action.icon ? { icon: action.icon } : {})}
        onPress={action.onPress}
        style={styles.action}
      />
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  card: {
    backgroundColor: v3.colors.surface,
    borderRadius: v3.radius.badge,
    gap: v3.space[10],
    paddingBottom: v3.space[14],
    paddingEnd: v3.space[8],
    paddingStart: v3.space[16],
    paddingTop: v3.space[12],
  },
  row: { alignItems: 'flex-start', flexDirection: 'row', gap: v3.space[12] },
  disc: {
    alignItems: 'center',
    borderRadius: v3.radius.pill,
    height: 44,
    justifyContent: 'center',
    marginTop: v3.space[2],
    width: 44,
  },
  words: { flex: 1, gap: v3.space[2], paddingTop: v3.space[2] },
  title: { ...v3.type.headline, color: v3.colors.fg },
  body: { ...v3.type.callout, color: v3.colors.fg },
  // In from the end by the ✕'s gutter, so the pill lines up with the text
  // above it rather than with the card's edge.
  action: { alignSelf: 'stretch', marginEnd: v3.space[8], width: 'auto' },
}))
