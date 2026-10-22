import type Feather from '@expo/vector-icons/Feather'
import { Text, View } from 'react-native'
import { makeStyles, useTheme, type PartnerHue } from '../../lib/theme'
import { Button } from './Button'

type Glyph = keyof typeof Feather.glyphMap

interface HeroTileProps {
  /**
   * `blue` is Echo's — the main thing to do that does not commit. A partner
   * hue is anything else's: tangerine for the streak. The text on it follows
   * (white on blue, ink on a hue), so a caller picks the block and never a
   * text colour.
   */
  tone: 'blue' | PartnerHue
  /** The figure, already formatted for the locale: "12". */
  value: string
  /** What the figure counts: "cards due". */
  unit: string
  /** A line under the unit: how long it takes, the longest run. */
  detail?: string
  /**
   * A full-width line above the button, beside a dashed ring: what pressing it
   * also does elsewhere — Echo's "Closes today's third ring · +5 tokens".
   */
  note?: string
  /**
   * The figure and its unit read as one, when the two apart would not make
   * sense — "12 cards due" from `echo.due` rather than "12", "cards due".
   */
  accessibilityLabel?: string
  /**
   * The block's one button. Yellow: when a screen has a hero, the hero holds
   * the action that screen is for, and the one yellow is that action.
   */
  action?: { label: string; onPress: () => void; icon?: Glyph }
}

/**
 * The one big block on a screen: a figure you came to know, and the button
 * that acts on it.
 *
 * Echo's 160pt press tile, grown into the drawings' block. That tile was the
 * button, which left the number and the action fighting over one shape; here
 * the figure is read and the pill is pressed. A hero without an action — the
 * streak's — is a heading, and is not pressable at all.
 */
export function HeroTile({
  tone,
  value,
  unit,
  detail,
  note,
  accessibilityLabel,
  action,
}: HeroTileProps) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const ground = tone === 'blue' ? v3.colors.blue : v3.hues[tone]
  const color = tone === 'blue' ? v3.colors.onBlue : v3.colors.ink

  return (
    <View style={[styles.tile, { backgroundColor: ground }]}>
      <View style={styles.figure}>
        <Text
          style={[styles.value, { color }]}
          // A figure in a fixed block, not reading text: at the largest text
          // sizes three digits would leave it. The unit beside it still
          // scales in full.
          maxFontSizeMultiplier={1.4}
          {...(accessibilityLabel ? { accessibilityLabel } : {})}
        >
          {value}
        </Text>
        <View style={styles.words}>
          {/* The label is on the figure and already says the unit. Not on the
              whole group, which would leave the detail unread. */}
          <Text
            style={[styles.unit, { color }]}
            {...(accessibilityLabel
              ? {
                  accessibilityElementsHidden: true,
                  importantForAccessibility: 'no-hide-descendants' as const,
                }
              : {})}
          >
            {unit}
          </Text>
          {detail ? <Text style={[styles.detail, { color }]}>{detail}</Text> : null}
        </View>
      </View>
      {note ? (
        <View style={styles.note}>
          {/* Dashed: the ring this fills, still open. Decoration — the words say it. */}
          <View style={[styles.ring, { borderColor: color }]} />
          <Text style={[styles.noteText, { color }]}>{note}</Text>
        </View>
      ) : null}
      {action ? (
        <Button
          label={action.label}
          {...(action.icon ? { icon: action.icon } : {})}
          onPress={action.onPress}
        />
      ) : null}
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  tile: {
    borderRadius: v3.radius.block,
    gap: v3.space[12],
    paddingBottom: v3.space[16],
    paddingHorizontal: v3.space[16],
    paddingTop: v3.space[16],
  },
  // Wraps, so a long unit in German drops under the figure rather than
  // squeezing it.
  figure: { alignItems: 'flex-end', flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[12] },
  value: v3.type.numeral,
  words: { flexShrink: 1, gap: v3.space[2], paddingBottom: v3.space[4] },
  unit: v3.type.headline,
  detail: { ...v3.type.callout, fontWeight: '600' },
  note: { alignItems: 'center', flexDirection: 'row', gap: v3.space[8] },
  ring: {
    borderRadius: v3.radius.pill,
    borderStyle: 'dashed',
    borderWidth: 2,
    height: 16,
    width: 16,
  },
  // Caption, a step under the detail: the drawing keeps it to one line at 390pt.
  noteText: { ...v3.type.caption, flexShrink: 1, fontWeight: '600' },
}))
