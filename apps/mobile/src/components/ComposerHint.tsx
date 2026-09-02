import { useEffect, useState } from 'react'
import { Text, type StyleProp, type TextStyle } from 'react-native'
import { useTips } from '../hooks/useTips'
import { useT } from '../i18n'
import type { MessageKey } from '../i18n/runtime'
import type { TipId } from '../lib/tips'

/**
 * The half-row under the chat composer.
 *
 * Not a `Tip`: it has no dismiss button and no yellow, because it is not
 * asking to be read — it is the place a reader's eye already is while they
 * type. It rotates through the same cursor for the same reason, though: it
 * used to say "hold a message to correct it" forever, directly beneath a
 * yellow tip that said exactly that.
 *
 * Renders nothing when tips are switched off. Before, this line was outside
 * that switch entirely, so turning tips off left one behind.
 */
export function ComposerHint({ style }: { style?: StyleProp<TextStyle> }) {
  const t = useT()
  const tips = useTips()
  // Frozen for the mount, and advanced once, for the reason `Tip` records:
  // advancing publishes, and a hint read live would swap for its own successor
  // in the same frame.
  const [id, setId] = useState<TipId | null>(null)
  const candidate = tips.settled ? tips.pick('composer') : null

  useEffect(() => {
    if (id || !candidate) return
    setId(candidate)
    tips.advance('composer')
  }, [candidate, id, tips])

  if (!id) return null
  return <Text style={style}>{t(`tips.${id}` as MessageKey)}</Text>
}
