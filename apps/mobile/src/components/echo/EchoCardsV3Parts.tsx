import Feather from '@expo/vector-icons/Feather'
import type { EchoCard } from '@langx/shared'
import { Pressable, Text, View } from 'react-native'
import { useT } from '../../i18n'
import { dueInCompact } from '../../lib/format'
import { makeStyles, useTheme, type V3Tokens } from '../../lib/theme'
import { partnerHueFor } from '../../lib/theme/partnerHue'
import { ICON_BUTTON_TARGET } from '../ui/IconButton'

/*
 * The pieces the redesign's card pages share (`V-EchoCards`, `V-EchoCard`):
 * the square that says where a card came from, the pill that says when it
 * comes back, and the language chips. Dumb, like `EchoV3Parts`: the page
 * hands each one its words.
 */

type Glyph = keyof typeof Feather.glyphMap

/**
 * A card's colour, by where it came from. A sentence from a chat is in the
 * hue of the person who wrote it — the same hue that person has on the Echo
 * tab and in Chats — and leads with their initial; the rest lead with a
 * glyph: the pen for your own, the lines for a post, the stack for a pack.
 * A phrase card is a chat's too, but it names no partner, so it takes the
 * pack's tint rather than borrowing somebody's colour.
 */
export function cardTone(
  card: EchoCard,
  v3: V3Tokens,
): { fill: string; text: string; glyph: Glyph | null; onHue: boolean } {
  switch (card.source.kind) {
    case 'chat':
      return {
        fill: v3.hues[partnerHueFor(card.source.partnerId)],
        text: v3.colors.ink,
        glyph: null,
        onHue: true,
      }
    case 'manual':
      return { fill: v3.hues.tangerine, text: v3.colors.ink, glyph: 'edit-2', onHue: true }
    case 'post':
      return { fill: v3.colors.line, text: v3.colors.fg, glyph: 'align-left', onHue: false }
    default:
      return { fill: v3.colors.echoTint, text: v3.colors.echoText, glyph: 'layers', onHue: false }
  }
}

/** The 40pt square at the start of a row: an initial on a hue, or a glyph. */
export function CardLeadV3({ card, initial }: { card: EchoCard; initial: string }) {
  const styles = useStyles()
  const { v3 } = useTheme()
  const tone = cardTone(card, v3)
  return (
    <View
      style={[
        styles.lead,
        tone.glyph ? styles.leadSquare : styles.leadRound,
        { backgroundColor: tone.fill },
      ]}
      // Decoration: the row's source line says the same in words.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {tone.glyph ? (
        <Feather name={tone.glyph} size={v3.icon.lg} color={tone.text} />
      ) : (
        <Text style={[styles.initial, { color: tone.text }]}>{initial}</Text>
      )}
    </View>
  )
}

/**
 * When the card comes back — `4d`, `10m`, or the words for one already due,
 * in the blue the drawing gives the cards this screen is usually opened for.
 * Two characters on the row and the whole sentence to a screen reader, as
 * the current list's pill does; nothing on a card that has been put away.
 */
export function DuePillV3({ card }: { card: EchoCard }) {
  const styles = useStyles()
  const t = useT()
  const time = dueInCompact(card.srs.due, { t })
  if (card.archivedAt) return null
  return (
    <View style={[styles.due, !time && styles.dueNow]}>
      <Text
        style={[styles.dueText, !time && styles.dueNowText]}
        accessibilityLabel={time ? t('echo.dueIn', { time }) : t('echo.dueNow')}
      >
        {time ?? t('echo.dueNow')}
      </Text>
    </View>
  )
}

/**
 * The language chips: All, then each language with a card. 44pt tall on iOS
 * and 48dp on Android, where the current look's chip is a little under; the selected one is the blue
 * fill, the rest an outline.
 */
export function LanguageChipsV3({
  allLabel,
  options,
  selected,
  onSelect,
}: {
  allLabel: string
  options: readonly { value: string; label: string }[]
  /** `null` is All. */
  selected: string | null
  onSelect: (value: string | null) => void
}) {
  const styles = useStyles()
  const chips: { value: string | null; label: string }[] = [
    { value: null, label: allLabel },
    ...options,
  ]
  return (
    <View style={styles.chips}>
      {chips.map((chip) => {
        const on = chip.value === selected
        return (
          <Pressable
            key={chip.value ?? 'all'}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onSelect(chip.value)}
            style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && styles.pressed]}
          >
            <Text style={[styles.chipLabel, on && styles.chipLabelOn]}>{chip.label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const useStyles = makeStyles(({ v3 }) => ({
  lead: { alignItems: 'center', height: 40, justifyContent: 'center', width: 40 },
  leadRound: { borderRadius: v3.radius.pill },
  leadSquare: { borderRadius: v3.radius.icon },
  initial: v3.type.buttonSmall,

  due: {
    backgroundColor: v3.colors.line,
    borderRadius: v3.radius.pill,
    paddingHorizontal: v3.space[8],
    paddingVertical: v3.space[2],
  },
  dueNow: { backgroundColor: v3.colors.blue },
  // Tabular figures, so the column of them down the list does not shuffle
  // sideways as `9m` becomes `10m`.
  dueText: { ...v3.type.label, color: v3.colors.fg, fontVariant: ['tabular-nums'] },
  dueNowText: { color: v3.colors.onBlue },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: v3.space[8] },
  chip: {
    alignItems: 'center',
    borderColor: v3.colors.line,
    borderRadius: v3.radius.pill,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: ICON_BUTTON_TARGET,
    paddingHorizontal: v3.space[16],
  },
  chipOn: { backgroundColor: v3.colors.blue, borderColor: v3.colors.blue },
  chipLabel: { ...v3.type.buttonSmall, color: v3.colors.fg },
  chipLabelOn: { color: v3.colors.onBlue },
  pressed: { opacity: 0.6 },
}))
