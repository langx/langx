import Feather from '@expo/vector-icons/Feather'
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useTips } from '../hooks/useTips'
import { useT } from '../i18n'
import type { MessageKey } from '../i18n/runtime'
import { makeStyles, useTheme } from '../lib/theme'
import type { TipId, TipSlot } from '../lib/tips'

interface TipProps {
  slot: TipSlot
  /**
   * Whether the tip owns the gaps around itself. True everywhere it sits in a
   * plain column, which is every screen but one.
   *
   * False in `chat/[id].tsx`, where it is part of an **inverted** list's
   * header: the list's own `gap` already spaces that cell, and a margin inside
   * a flipped cell lands visually *above* the tip rather than below it, so it
   * would double the gap at the top and leave none at the bottom.
   */
  spaced?: boolean
}

/**
 * A one-line hint that can be sent away and does not come back.
 *
 * The accent wash with plain ink text, and deliberately **not** a `Callout`:
 * that component's doc comment reserves `info` for Copilot and `success` for
 * corrections, because those two are the voices of the core loop and a reader
 * has to tell them apart at a glance. A tip is neither — no icon, no coloured
 * title, and its sentence set in `text` rather than in a tone's colour — which
 * is what keeps it from reading as either of them.
 *
 * Renders nothing once dismissed, and nothing at all when tips are switched
 * off. Both are the same check, so a screen never has to ask twice.
 */
export function Tip({ slot, spaced = true }: TipProps) {
  const t = useT()
  const tips = useTips()
  const styles = useStyles()
  const { colors } = useTheme()
  const [sentAway, setSentAway] = useState(false)
  /*
   * Held for the life of this mount, and that is load-bearing rather than an
   * optimisation. Advancing the cursor publishes, which re-renders this
   * component — so a tip read live from the store would be replaced by its own
   * successor in the same frame, and the first entry in every slot would never
   * be seen at all.
   */
  const [id, setId] = useState<TipId | null>(null)

  const candidate = tips.settled ? tips.pick(slot) : null

  /*
   * Moved on as soon as something is shown, not when it is dismissed: most
   * tips are read and left alone, and a cursor that only advanced on dismissal
   * would teach the same thing until the reader actively refused it — which is
   * the behaviour this replaces.
   */
  useEffect(() => {
    if (id || !candidate) return
    setId(candidate)
    // `tips` is rebuilt every render; `id` above is what makes this happen once.
    tips.advance(slot)
  }, [candidate, id, slot, tips])

  // Sending one away empties the row for this visit rather than sliding the
  // next one into its place, which would read as the dismissal having failed.
  if (!id || sentAway) return null
  const body = `tips.${id}` as MessageKey

  return (
    <View style={[styles.root, spaced && styles.spaced]}>
      <Text style={styles.body}>{t(body)}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('tips.dismiss')}
        onPress={() => {
          setSentAway(true)
          tips.dismiss(id)
        }}
        hitSlop={12}
        style={({ pressed }) => [styles.close, pressed && styles.pressed]}
      >
        <Feather name="x" size={16} color={colors.accent} />
      </Pressable>
    </View>
  )
}

const useStyles = makeStyles(({ colors, radius, spacing }) => ({
  root: {
    alignItems: 'center',
    backgroundColor: colors.accentBg,
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  /**
   * The gaps around a tip belong to the tip, not to the list under it.
   *
   * They used to belong to whatever happened to sit above: chats spelled it as
   * `filters.paddingBottom` *and* `list.paddingTop`, feed had neither, and
   * discover got 14 by accident from an empty chip row's `marginTop`. Three
   * screens spaced three different ways, and the feed's tip ended up flush
   * against the segmented control above it.
   *
   * The design wants 16 above a tip and 8 below it, but only 8 between the
   * header and the list when there is no tip — and a dismissed tip renders
   * `null`, so it cannot leave a margin behind. The header keeps its 8, and
   * the tip brings the other 8 with it.
   */
  spaced: { marginBottom: spacing.sm, marginTop: spacing.sm },
  body: { color: colors.text, flex: 1, fontSize: 14, lineHeight: 20 },
  close: { alignItems: 'center', height: 22, justifyContent: 'center', width: 22 },
  pressed: { opacity: 0.6 },
}))
