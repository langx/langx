import { useEffect, useState } from 'react'
import { Text, type StyleProp, type TextStyle } from 'react-native'
import { useTips } from '../hooks/useTips'
import { useT } from '../i18n'
import type { MessageKey } from '../i18n/runtime'
import type { TipId, TipSlot } from '../lib/tips'

/**
 * The half-row under the chat composer.
 *
 * Not a `Tip`: it has no dismiss button and no yellow, because it is not
 * asking to be read — it is the place a reader's eye already is while they
 * type. It rotates through the same cursor for the same reason, though: it
 * used to say "hold a message to correct it" forever, directly beneath a
 * yellow tip that said exactly that.
 *
 * `slot` defaults to the composer's. The thread's opening tip passes `'chat'`:
 * v3 draws that as the same undismissable line of text — centred and tinted,
 * styled by the caller — rather than as a `Tip` card, so it is this component
 * with a different pool and not a third one.
 *
 * Renders nothing when tips are switched off. Before, this line was outside
 * that switch entirely, so turning tips off left one behind.
 */
export function ComposerHint({
  slot = 'composer',
  style,
}: {
  slot?: TipSlot
  style?: StyleProp<TextStyle>
}) {
  const t = useT()
  const tips = useTips()
  // Frozen for the mount, and advanced once, for the reason `Tip` records:
  // advancing publishes, and a hint read live would swap for its own successor
  // in the same frame.
  const [id, setId] = useState<TipId | null>(null)
  const candidate = tips.settled ? tips.pick(slot) : null

  useEffect(() => {
    if (id || !candidate) return
    setId(candidate)
    tips.advance(slot)
  }, [candidate, id, slot, tips])

  if (!id) return null
  return <Text style={style}>{t(`tips.${id}` as MessageKey)}</Text>
}
