import Feather from '@expo/vector-icons/Feather'
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useTips } from '../hooks/useTips'
import { useT } from '../i18n'
import type { MessageKey } from '../i18n/runtime'
import { calloutColours } from './ui/Callout'
import { makeStyles, useTheme } from '../lib/theme'
import type { TipId, TipSlot } from '../lib/tips'

interface TipProps {
  slot: TipSlot
}

/**
 * A one-line hint that can be sent away and does not come back.
 *
 * `warning` rather than `info` or `success`, and that is not a colour choice:
 * `Callout`'s doc comment reserves `info` for Copilot and `success` for
 * corrections, because those two are the voices of the core loop and a reader
 * has to tell them apart at a glance. A tip is neither, so it takes the
 * unclaimed tone.
 *
 * Renders nothing once dismissed, and nothing at all when tips are switched
 * off. Both are the same check, so a screen never has to ask twice.
 */
export function Tip({ slot }: TipProps) {
  const t = useT()
  const tips = useTips()
  const styles = useStyles()
  const { colors } = useTheme()
  const { bg, fg } = calloutColours(colors, 'warning')
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
    <View style={[styles.root, { backgroundColor: bg }]}>
      <Feather name="info" size={16} color={fg} style={styles.icon} />
      <Text style={[styles.body, { color: fg }]}>{t(body)}</Text>
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
        <Feather name="x" size={16} color={fg} />
      </Pressable>
    </View>
  )
}

const useStyles = makeStyles(({ font, radius, spacing }) => ({
  root: {
    alignItems: 'flex-start',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  // Nudged to sit on the first line of a wrapping sentence.
  icon: { marginTop: 1 },
  body: { ...font.caption, flex: 1, fontSize: 13, lineHeight: 19 },
  close: { alignItems: 'center', height: 22, justifyContent: 'center', width: 22 },
  pressed: { opacity: 0.6 },
}))
